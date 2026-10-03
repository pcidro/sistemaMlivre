# Importação Magalu por período

`MagaluImportService.execute({ marketplaceAccountId, userId, dateFrom, dateTo })`
coordena uma execução completa, reutilizando o mecanismo de persistência existente.
O `ImportRunner` reúne a coordenação comum ao Mercado Livre e à Magalu: autorização,
registro de execução, lotes, concorrência, contadores e conclusão. Cada plataforma
mantém seu próprio adapter para consultar e processar os pedidos.

## Rota autenticada

`POST /api/imports/magalu` recebe:

```json
{
  "marketplaceAccountId": "4c30f898-e643-4b09-bcbd-af09e546bbae",
  "dateFrom": "2026-09-01T00:00:00-03:00",
  "dateTo": "2026-09-30T23:59:59-03:00"
}
```

O prefixo `/api` já é aplicado em `server.ts`. A autenticação usa o cookie ou
Bearer aceito pelo middleware existente. `userId` vem exclusivamente de
`req.user_id`; campos extras no body são recusados. A conta deve estar ativa,
pertencer ao usuário e ter `platform=MAGALU`, antes de criar o Import ou consultar
pedidos. O modelo atual vincula contas ao usuário; não há entidade de empresa
adicional para autorizar.

UUID, datas e intervalo são validados pelo schema compartilhado das importações.
Instantes ISO 8601 precisam de fuso. Datas simples `YYYY-MM-DD` representam o
início e fim do dia em UTC, seguindo o padrão existente. O retorno HTTP 200 é o
resumo final, incluindo execuções `PARTIAL_SUCCESS` e `ERROR`; consulte `status`.
Não há tokens, XMLs ou dados pessoais na resposta. Falhas de autenticação,
validação, autorização e concorrência usam 401, 400, 404 e 409 respectivamente;
falha que impede registrar o resultado usa 503.

## Processamento

1. Valida a conta e cria `Import` com `platform=MAGALU` e `status=PROCESSING`.
2. Consome páginas de pedidos via `MagaluOrderService`, usando os filtros oficiais
   `purchased_at__gte`/`purchased_at__lte` e paginação `_offset`/`_limit`.
3. Processa pedidos normalizados em lotes, aguardando a conclusão antes da página seguinte.
4. `MagaluOrderImportService` usa os dados do pedido como fonte principal.
   Entregas e NF-e só são consultadas para completar campos ausentes; não há
   consulta fiscal adicional quando nome, telefone e documento já estão presentes.
5. Reutiliza `NFeParserService` e `ImportedOrderPersistenceService` para salvar
   cliente, pedido, produtos e notas processadas em uma transação por pedido.
6. Atualiza progresso e finaliza com status e `finishedAt`.

A persistência mantém a chave `marketplaceAccountId + externalOrderId`, usa o
`code` oficial como identidade do pedido e preserva valores válidos na
reimportação. Notas não são necessárias para salvar um pedido. Consultar
[persistência por pedido](MagaluOrderImportService.md) e [regras compartilhadas](README.md).
Nenhuma migration nova é necessária para este coordenador.

## Contadores e falhas

| Campo | Significado |
| --- | --- |
| `ordersFound` | Pedidos normalizados únicos encontrados, mais registros rejeitados pelo mapper. |
| `ordersProcessed` | Pedidos cuja transação terminou com sucesso, incluindo reimportações. |
| `customersWithPhone` | Pedidos processados cujo cliente salvo possui telefone; não é contagem de clientes únicos. |
| `customersWithoutPhone` | Pedidos processados cujo cliente salvo não possui telefone. |
| `errorsCount` | Uma ocorrência por pedido com falha, inclusive fallback fiscal incompleto; mais falhas que interrompem paginação/progresso. |

IDs repetidos em páginas não são processados nem contados novamente. Um registro
rejeitado pelo mapper é contabilizado e não interrompe os outros; sua identidade
não normalizada não é usada para deduplicação. Envelope inválido ou página repetida
interrompe a leitura, preservando os pedidos já salvos.

Uma falha por pedido não cancela os demais. Falhas opcionais de entrega/NF-e
preservam os dados disponíveis e contam uma vez por pedido afetado, mesmo quando
ocorrem em várias notas. Se a persistência desse pedido também falhar, ele continua
contando apenas um erro. Ausência normal de NF-e não conta como falha.

- `SUCCESS`: sem erros; intervalo sem pedidos também conclui com sucesso.
- `PARTIAL_SUCCESS`: há erros e pelo menos um pedido foi persistido.
- `ERROR`: há erros e nenhum pedido foi persistido.

Não existe uma transação para o período inteiro: uma falha não desfaz outros
pedidos. Se o armazenamento do resumo final falhar, a rota retorna 503 e não
inventa uma conclusão; pedidos já persistidos permanecem salvos.

## Concorrência e rate limit

Padrões: até **3 pedidos simultâneos**, lotes de **20** para processamento. As
dependências permitem concorrência de 1–10 e lote de 1–50, sem aceitar valores
ilimitados. A consulta de pedidos também possui seu limite de página próprio.
Somente as identidades dos pedidos são acumuladas no período; pedidos/XMLs são
processados por lote e descartados.

O `MagaluClient` e o limitador compartilhado por tenant controlam chamadas,
refresh, intervalos e espera após 429/`Retry-After`. Tentativas temporárias ficam
no client existente, com limite; o core não adiciona outro ciclo de retry.
Configuração sandbox/produção e canais seguem os serviços existentes.

A execução é síncrona, como no Mercado Livre. O bloqueio de importações da mesma
conta é local à instância do serviço/processo, sem trava distribuída entre réplicas.
Reinício do processo pode deixar um Import em `PROCESSING`; este trabalho não
introduz fila, retomada automática ou recuperação desses registros. Reimportar
mantém a proteção contra duplicatas da persistência.

## Validação

`npm test` inclui testes do coordenador, rota, repositório e regressões do Mercado
Livre. Há testes do fluxo Magalu com client, mapper, fallback, parser e persistência
compartilhada, usando HTTP simulado e banco em memória: páginas, dados inválidos,
429, falhas intermediárias, reimportação e processamento de NF-e.
Nenhum teste consulta dados reais nem acessa o Neon. O banco em memória não
valida locks reais do PostgreSQL; concorrência do coordenador é verificada
separadamente com tarefas controladas.

Contrato oficial de pedidos:
[GET /seller/v1/orders](https://developers.magalu.com/docs/apis/orders/ref/seller-v-1-get-order-list/index.html).
