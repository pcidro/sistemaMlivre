# Leitura de entregas Magalu

Documentação oficial consultada em 02/10/2026:

- [GET /seller/v1/deliveries](https://developers.magalu.com/docs/apis/orders/ref/seller-v-1-get-deliveries-list/index.html).
- [GET /seller/v1/orders/:code](https://developers.magalu.com/docs/apis/orders/ref/seller-v-1-get-order-by-id/index.html).
- [Canais oficiais de sandbox](https://developers.magalu.com/docs/apis/sandbox/overview/index.html).

## Uso e dados internos

```ts
const service = new MagaluDeliveryService(userId); // req.user_id no futuro controller
for await (const deliveries of service.getDeliveries({
  marketplaceAccountId,
  externalOrderId: order.externalOrderId,
})) {
  // Consumir este lote de referências normalizadas.
}
```

O código é o `externalOrderId` do pedido já normalizado por `MagaluOrderMapper`.
O retorno é `AsyncGenerator<MarketplaceDelivery[]>`. O tipo interno contém:

| Campo | Origem / finalidade |
| --- | --- |
| `externalDeliveryId` | `delivery.id`: identificador necessário para uma futura consulta fiscal. |
| `externalDeliveryCode` | `delivery.code`: código do pacote, quando disponível; não confundir com código do pedido. |
| `externalOrderId` | `delivery.order.code`: vínculo com o pedido solicitado. |
| `channelId` | `delivery.order.channel.id`: canal da venda. |
| `status` | Status do pacote, distinto do status do pedido; ausência vira null. |
| `marketplaceAccountId` | Conta autorizada utilizada na consulta. |
| `platform` | MAGALU. |

Não expõe payload bruto, destinatário, endereço, produtos, valores ou informações
de notas fiscais. Os tipos externos/projeções Zod ficam em
`magaluDelivery.types.ts`, dentro da integração. A estrutura `MarketplaceDelivery`
é compartilhada, sem alterações no schema Prisma ou nos tipos de pedidos existentes.

## Resolução do canal

Produção: o serviço consulta `/seller/v1/orders/:code` e lê `channel.id` retornado
pela API da conta autorizada. Não usa o canal de produção da configuração como
fallback, não aceita um canal manual na entrada e não escolhe um UUID de exemplo.
Canal ausente/inválido ou código diferente do solicitado produzem erro seguro.
Essa resolução usa o scope de leitura de pedidos já presente na aplicação.

Sandbox: usa exclusivamente `getMagaluConfig().channelId` do ambiente sandbox,
com o identificador oficial já centralizado; não consulta um canal de produção.
O host é definido pelo `MagaluClient`, conforme `MAGALU_ENV`.

Na consulta de pacotes, envia `X-Channel-Id` e o filtro oficial `code` do pedido.
Confere `order.code` e `order.channel.id` de todas as entregas antes de retorná-las,
inclusive no sandbox. Um canal ou pedido incompatível é erro, sem reatribuir o
pacote ao pedido por suposição. UUIDs de canal aceitam diferenças de caixa.

## Paginação e falhas

Usa `_offset`, `_limit` e `_sort=purchased_at:asc`. O lote padrão solicita 20
registros; `pageSize` nas dependências aceita 1–100 como limite local de memória.
O offset avança pela quantidade recebida, reduz o limite se `max_limit` for menor
e continua após páginas curtas até `results=[]`. Valida metadados e detecta
repetição da última página sem guardar todo o histórico. Links retornados pela
API não alteram o destino ou os filtros das consultas.

`MagaluClient` cuida da autorização Bearer, refresh, 403, 429/Retry-After,
timeouts e tentativas limitadas. O serviço não adiciona outro loop de retries.
404 é propagado como recurso não encontrado; não é convertido em resultado
vazio. Uma página vazia válida indica ausência/fim das entregas. HTTP 204,
payload malformado e IDs/canais obrigatórios ausentes geram `invalid_response`.
Erros preservam o request ID seguro, sem incluir payload ou dados pessoais.

A conta deve pertencer ao usuário do construtor, estar ativa e ser da Magalu.
O serviço lê a conta pelo storage existente. Não persiste clientes, pedidos,
entregas ou notas; o refresh do client pode salvar somente credenciais
criptografadas conforme o fluxo já existente.

Não consulta `/invoices`, não baixa XML e não usa parser de NF-e. A referência
do pacote, seu canal e conta são suficientes para implementar o próximo acesso
fiscal quando essa etapa for solicitada. Não acrescenta rotas ou frontend.

## Testes

`MagaluDeliveryService.test.ts` simula todas as respostas e a conta, usando o
client real com transporte e relógio controlados. Cobre uma/várias entregas,
ausência, 404, 429, produção/sandbox, canal incompatível, paginação e respostas
inválidas. O canal fictício de produção das fixtures existe apenas nos mocks,
para comprovar que o serviço usa o canal recebido e não o configurado.
Nenhuma chamada à API real foi executada.
