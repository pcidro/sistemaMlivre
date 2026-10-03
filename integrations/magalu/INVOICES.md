# Consulta e extração de NF-e Magalu

`MagaluInvoiceService` consulta somente `GET /seller/v1/deliveries/:id/invoices`.
Contrato oficial conferido em 02/10/2026: [Buscar NF-es](https://developers.magalu.com/docs/apis/orders/ref/seller-v-1-get-deliveries-invoices/index.html).
Requer o scope de leitura já configurado, `open:order-invoice-seller:read`.

```ts
import { MagaluInvoiceService } from "./integrations";

const service = new MagaluInvoiceService(userId);
const invoice = await service.getInvoice({
  delivery, // MarketplaceDelivery retornada por MagaluDeliveryService
  customer: order.customer, // customer normalizado por MagaluOrderMapper
  onInvoiceError: error => {
    // Diagnóstico opcional: code, requestId e providerStatus, sem payload bruto.
  },
});
```

Não há novas rotas, alterações de schema ou persistência de notas/clientes.
A conta precisa estar ativa, ser Magalu e pertencer ao usuário autenticado.
O transporte, proteção dos tokens, refresh, timeout e retries continuam no
`MagaluClient`; este serviço não repete essas regras.

## Canal e paginação

O header obrigatório `X-Channel-Id` recebe o canal da entrega normalizada,
resolvido pelo serviço de entregas a partir da API. Sandbox aceita somente o
canal oficial de `getMagaluConfig()`. Em produção, não há fallback para um canal
fixo. A baseURL continua centralizada na configuração de ambiente.

Paginação com `_offset`, `_limit` e ordenação oficial `created_at:asc`.
Lotes de cinco notas por padrão, configuráveis entre 1 e 20; o limite diminui
se `meta.page.max_limit` for menor. A consulta continua até uma página vazia,
inclusive após páginas curtas ou `links.next = null`. Não segue URLs externas
de links e rejeita metadados inconsistentes ou repetição da página anterior.
Somente uma candidata extraída é retida entre páginas, sem acumular XMLs.

## Parser e retorno

`xml` contém o XML diretamente. Não é tratado como URL nem baixado de outro
endpoint. O mesmo `NFeParserService` utilizado pelo Mercado Livre extrai chave,
número, nome, telefone, CPF/CNPJ e tipo. O parser permanece inalterado.
O serviço confere a chave extraída contra `key` e utiliza o `normalizePhone`
compartilhado para retornar telefone internacional ou `null`.

Somente status `approved` é elegível; `validating`, `invalid` e status
desconhecidos não identificam um cliente. A data `issued_at` é validada e
retornada como `issuedAt` em sua representação ISO original: a documentação
inclui datas sem fuso, portanto não se presume UTC. Campos opcionais ausentes
retornam `null`. O resultado `MagaluProcessedInvoice` nunca contém XML ou tokens.

## Várias notas e destinatário

- Se o pedido possui documento normalizado, somente notas cujo destinatário
  tenha o mesmo CPF/CNPJ e tipo podem ser selecionadas.
- Sem documento do pedido, uma nota utilizável pode ser selecionada. Havendo
  várias, todas devem identificar o mesmo documento de destinatário; documentos
  diferentes ou ausentes tornam a seleção ambígua e retornam `null`.
- Entre notas do mesmo destinatário, prefere telefone válido, depois nome
  disponível; empates usam a menor chave em ordem lexical. Não mistura campos
  de notas de destinatários diferentes.
- Toda a coleção é consultada antes de retornar. Nunca assume que a primeira
  nota é a correta nem que existe exatamente uma nota.

## Ausência e erros

Página vazia, nenhuma nota aprovada disponível, XML ausente, ou 404/204 na
primeira consulta retornam `null`. Se outra nota aprovada não tem XML e não há
documento do pedido para conferir o destinatário, também retorna `null`.
Ausência da conta ou falta de permissão continuam sendo erros.

XML inválido, chave divergente e metadados fiscais inválidos geram erros seguros
`invalid_response`, com `X-Request-ID` quando válido e disponível. As outras
notas continuam sendo processadas. O callback opcional recebe esses erros.
Uma nota válida conferida com o documento do pedido pode ser retornada apesar
de outra inválida. Sem essa conferência ou sem candidata, o erro é propagado;
XML inválido não é confundido com ausência de nota.

Erros HTTP durante a paginação são propagados, evitando retornar uma seleção
incompleta. 403, 429 e falhas temporárias usam o tratamento e os limites de
retry do client existente. Os testes usam chamadas simuladas e XMLs fictícios;
não houve consulta à conta real ou ao sandbox nesta implementação.
