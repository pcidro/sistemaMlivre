# Tipos externos e mapeamento de pedidos Magalu

Contrato consultado em 02/10/2026:
[GET /seller/v1/orders](https://developers.magalu.com/docs/apis/orders/ref/seller-v-1-get-order-list/index.html).

`magaluOrder.types.ts` contém os tipos MagaluOrderResponse, MagaluOrder,
MagaluCustomer, MagaluPhone, MagaluDelivery e MagaluOrderItem, inferidos dos
schemas Zod. É uma projeção dos campos necessários, não uma cópia de todos os
dados fiscais, financeiros, de endereço e rastreio. Campos adicionais são
descartados. O envelope possui `meta.links`, `meta.page` e `results`.

`new MagaluOrderMapper().map(payload)` valida um pedido recebido como `unknown`
e devolve exclusivamente `MarketplaceOrder`, reutilizando `MagaluCustomerExtractor`
para os dados de `order.customer`. Não depende de HTTP, tokens,
configuração de ambiente ou banco de dados. `MagaluOrderService` usa esse mapper
para consultar pedidos normalizados, sem persistência/importação.

| Origem Magalu | Campo interno / regra |
| --- | --- |
| `code` | `externalOrderId`: código textual usado na consulta oficial; preserva zeros iniciais. Sem fallback para o UUID `id`, evitando alternância de identidade. |
| `status` | Status do pedido, preservado; não confundir com status de cada entrega. |
| `purchased_at` | `orderDate`, com o instante do pagamento/compra e seu offset. Ausência vira null; não usar `created_at` como substituto. |
| `customer.name` | Nome sem espaços nas extremidades; ausente/vazio vira null. |
| `customer.phones` | Telefone brasileiro selecionado e normalizado por `normalizePhone()`. |
| `customer.document_number` / `customer_type` | `normalizeCustomerDocument()` reutiliza `normalizeDocument()`. `cpf`/`cnpj` viram CPF/CNPJ; conflito, tipo desconhecido ou documento inválido resultam em null. Tipo ausente é inferido pelo helper compartilhado. |
| `deliveries[].items[]` | Linhas reunidas na ordem original, sem inventar itens, somar ou deduplicar SKUs. |
| `items[].info.id` / `info.sku` | Identificador do produto; SKU somente quando id estiver ausente. |
| `items[].info.name` / `info.description` | Nome do produto; descrição somente quando nome estiver ausente. |
| `items[].quantity` | Inteiro não negativo, sem assumir quantidade padrão. |
| `items[].unit_price` | Valor dividido exatamente pelo `normalizer`; BRL com normalizadores em potências de dez. Ex.: value=1990 e normalizer=100 resulta em "19.90". Dados incompletos viram null. |

Telefone: montar `country_code` + `area_code` + `number`, quando presentes.
Antes de acrescentar os componentes, `MagaluCustomerExtractor` verifica com
`normalizePhone()` se `number` já é completo. Assim, não duplica DDI nem DDD.
Um início `55` sozinho não basta para identificar DDI: pode ser DDD ou parte
do número local. Número completo com DDD conflitante é ignorado.
Priorizar o primeiro número válido do grupo `mobile`, depois o primeiro do
grupo `comercial`/`residential`, depois o primeiro de qualquer outro tipo.
Empates mantêm a ordem original. Esses nomes são os exemplos oficiais; não há
aliases como `commercial`. Números incompletos ou inválidos são ignorados.
País explicitamente estrangeiro vira null porque a função compartilhada só
suporta telefones brasileiros. Sem DDD, um número já completo pode ser
normalizado pelo helper existente; um número local incompleto não é corrigido.

Nome e documento de `shipping.recipient` não substituem `customer`: comprador
e destinatário podem ser pessoas diferentes. Email fica restrito ao tipo externo
e não entra no resultado interno. A validação de documento é estrutural, sem
verificação dos dígitos verificadores, conforme o helper existente.

Código ausente, data presente inválida, estrutura incorreta ou item sem nome/
descrição ou quantidade válida geram AppError 502 sem payload/dados pessoais.
Moeda explicitamente diferente de BRL e normalizadores não suportados também
geram erro, sem inventar conversão financeira. O mapper trata um pedido por vez;
o core de importação isola e contabiliza erros por pedido.

As seis fixtures sintéticas em `fixtures/magaluOrders.ts` cobrem CPF, CNPJ,
celular, vários telefones, sem telefone e sem documento. Não são registros de
clientes reais nem geração de pedidos de sandbox. Os testes não fazem chamadas
à API nem persistência. Execute `npx tsx --test integrations/magalu/MagaluOrderMapper.test.ts`
na pasta backend, ou `npm test` para a suíte completa.

## Extração direta: MagaluCustomerExtractor

`new MagaluCustomerExtractor().extract(order)` recebe o pedido externo e valida
somente a projeção `customer`. Retorna `{ name, phone, document, documentType }`,
com null para informações ausentes. Código, itens e datas não são necessários
para extrair o cliente. Reutiliza `normalizePhone()` e
`normalizeCustomerDocument()` (que já aplica `normalizeDocument()`), sem outra
implementação de normalização. A lógica saiu do mapper para esse componente:
há um único caminho para selecionar telefone e mapear CPF/CNPJ na Magalu.

Não depende de NF-e nem busca dados de `shipping.recipient`. Não faz chamadas
HTTP ou persistência; apenas transforma o `order.customer` que a API fornecer.
Fixtures e testes confirmam o mapeamento do contrato, sem consultar dados reais
da conta da cliente ou comprovar disponibilidade desses campos em todos os pedidos.

`MagaluCustomerExtractor.test.ts` cobre CPF + celular, CNPJ + telefone, vários
telefones, ausência de telefone/documento, campos parciais, DDI/DDD já preenchidos
e integração com o mapper. O `CustomerExtractionService` compartilhado e o
Mercado Livre mantêm seu comportamento existente.

## Consulta paginada: MagaluOrderService

O serviço recebe o usuário autenticado no construtor para autorizar a conta.
A entrada de `getOrders()` mantém `marketplaceAccountId`, `dateFrom` e `dateTo`.
Datas são objetos `Date` válidos e o início não pode ser posterior ao fim.

```ts
const service = new MagaluOrderService(userId); // req.user_id no controller
for await (const orders of service.getOrders({ marketplaceAccountId, dateFrom, dateTo })) {
  // Processar/consumir este lote antes de solicitar o próximo.
}
```

O retorno é `AsyncGenerator<MarketplaceOrder[]>`; não há array que acumule o
intervalo inteiro. A leitura da conta reutiliza o storage existente e verifica
dono, plataforma e atividade antes de criar o `MagaluClient`. Este serviço não
consulta entregas separadamente nem cria pedidos fictícios; é consumido pelo
core em `POST /api/imports/magalu`.

As consultas usam somente `/seller/v1/orders`, com `_offset`, `_limit`,
`_sort=purchased_at:asc`, `purchased_at__gte` e `purchased_at__lte`. O período é
fixado com `toISOString()` (UTC com milissegundos), sem arredondar dias, mudar o
instante representado pelo fuso de origem ou aplicar retenção do Mercado Livre.
O host de sandbox/produção vem do client; este endpoint não exige channel no
contrato consultado e o serviço não adiciona um header genérico de canal.

O lote padrão solicita 20 registros; `pageSize` nas dependências permite 1–100,
um limite local de memória. O serviço reduz as próximas solicitações se a API
informar `meta.page.max_limit` menor. O offset avança pelo número de resultados
recebidos, sem presumir que cada página esteja cheia nem usar `count` como total
do intervalo. Busca a próxima página até `results=[]`, mesmo após página curta
ou `meta.links.next` ausente. Não segue URLs/queries externas retornadas em links.
O próximo request só começa quando o consumidor pedir o próximo lote; interromper
o `for await` impede novas consultas.

Refresh, 401, 403, 429/Retry-After e falhas temporárias reutilizam o `MagaluClient`,
sem duplicar tentativas. Se o erro persistir, o iterador lança o erro do client:
lotes anteriores permanecem entregues, mas a consulta não sinaliza conclusão.
Envelope inválido, 204, metadados inconsistentes ou repetição da última página
geram erro seguro `invalid_response` com request ID, sem payload/dados pessoais.
A comparação guarda só o hash da última página, não todos os IDs do intervalo.
Por padrão, um pedido rejeitado pelo mapper interrompe seu lote. Com o callback
opcional `onOrderError`, usado pelo core de importação, o serviço reporta o erro
seguro e continua os outros pedidos. O core contabiliza cada rejeição. Offset
avança por todos os registros recebidos, inclusive os rejeitados; um lote sem
pedidos válidos não encerra a paginação enquanto houver resultados brutos.

Não salva clientes, pedidos, notas ou imports. Apenas o gerenciamento de tokens
já existente pode atualizar credenciais criptografadas quando houver refresh.
O schema ainda não separa contas por ambiente: o client valida a audience do
token e a configuração; não reutilizar a autorização de sandbox como produção.

Testes em `MagaluOrderService.test.ts` usam somente conta/storage em memória,
respostas HTTP simuladas e relógio controlado. Não fazem chamadas reais.
