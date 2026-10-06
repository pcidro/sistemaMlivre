# Importação do Mercado Livre

`MercadoLivreImportService.execute({ marketplaceAccountId, userId, dateFrom, dateTo })` coordena os serviços de busca, destinatário, NF-e, extração e persistência. Não recebe payloads brutos de marketplace e não implementa interface visual.

## Rota

`POST /api/imports/mercadolivre`, seguindo o prefixo `/api` do backend. Exige a autenticação existente por cookie `auth_token` ou Bearer token. `userId` vem exclusivamente de `req.user_id`; campos extras no corpo são recusados.

```json
{
  "marketplaceAccountId": "4c30f898-e643-4b09-bcbd-af09e546bbae",
  "dateFrom": "2026-09-01T00:00:00-03:00",
  "dateTo": "2026-09-30T23:59:59.999-03:00"
}
```

Datas devem ser ISO 8601 com fuso horário ou `YYYY-MM-DD`. Datas simples representam dias completos em **UTC**: início às `00:00:00.000Z`, fim às `23:59:59.999Z`. Para dias no horário brasileiro, envie timestamps com `-03:00`. O intervalo é inclusivo e o início não pode ser posterior ao fim. O serviço de pedidos aplica a disponibilidade histórica da API (últimos 12 meses) e limita a consulta ao momento atual.

A conta precisa ser ativa, ser do Mercado Livre e pertencer ao usuário autenticado. A verificação ocorre antes de criar `Import` ou consultar o marketplace. A persistência de cada pedido verifica novamente a conta e o usuário dentro da transação.

A resposta HTTP 200 contém o registro resumido, com `id`, `marketplaceAccountId`, `status`, `startedAt`, `finishedAt` e os cinco contadores. Importações concluídas com falhas retornam seu status `PARTIAL_SUCCESS` ou `ERROR` no resumo. Erros de autenticação, entrada, propriedade da conta ou impossibilidade de registrar o resultado usam os erros HTTP habituais.

## Processamento e contadores

1. Cria `Import` em `PROCESSING`.
2. Consome páginas sem acumular todos os pedidos; registra os encontrados antes de processar cada página.
3. Processa lotes de até 20 pedidos, com no máximo **3 pedidos simultâneos**.
4. Executa `CustomerExtractionService`: dados do pedido/envio primeiro; NF-e quando faltar telefone ou CPF/CNPJ válido. Captura o resultado do parser para persistir a nota sem analisar o XML duas vezes. XML é transitório e nunca é enviado ao banco ou ao cliente HTTP.
5. Usa as transações idempotentes de `ImportedOrderPersistenceService`; registra progresso após cada lote.
6. Define o status e `finishedAt`, retornando os contadores persistidos.

| Contador | Definição |
| --- | --- |
| `ordersFound` | Pedidos únicos encontrados no período; inclui registros malformados reportados pela busca. |
| `ordersProcessed` | Pedidos salvos com sucesso, incluindo atualizações de pedidos já existentes. |
| `customersWithPhone` | Pedidos processados cujo cliente salvo tem telefone normalizado, inclusive quando um telefone anterior foi preservado. |
| `customersWithoutPhone` | Pedidos processados cujo cliente salvo não tem telefone. |
| `errorsCount` | Pedidos que falharam, mais eventual falha geral da busca ou do registro de progresso. |

Os contadores de clientes representam os clientes de cada pedido processado, não uma contagem de pessoas distintas. `customersWithPhone + customersWithoutPhone = ordersProcessed`. IDs válidos repetidos entre páginas não são processados duas vezes na mesma execução. Registros malformados sem identidade confiável contam por ocorrência.

- `SUCCESS`: nenhuma falha, inclusive período sem pedidos.
- `PARTIAL_SUCCESS`: pelo menos um pedido salvo e pelo menos uma falha.
- `ERROR`: há falhas e nenhum pedido salvo.

Uma falha de destinatário ou gravação afeta apenas aquele pedido. Se a consulta/XML da NF-e complementar falhar, os dados já obtidos do destinatário ainda são salvos e o pedido conta também como erro, produzindo PARTIAL_SUCCESS. A busca isola registros malformados quando chamada pelo importador. Uma falha geral de paginação encerra a busca; os pedidos já salvos permanecem válidos. Nenhuma mensagem externa ou XML é incluído no resumo/logs pelo importador.

## Concorrência e limites da API

Pedidos, destinatários e documentos usam o mesmo `MercadoLivreRequestLimiter`: pelo menos 250ms entre inícios de requisições, timeout de 15s, sem redirecionamentos. Uma resposta 429 bloqueia novas requisições até o `Retry-After` (segundos ou data HTTP), mesmo se ultrapassar 30s; sem cabeçalho, a pausa mínima é 2s. Pedidos e documentos mantêm suas tentativas limitadas existentes; destinatários repetem 429 até três tentativas. A renovação de token é compartilhada entre consultas concorrentes da mesma conta.

O espaçamento é uma política conservadora interna, não uma afirmação de cota oficial. A implementação segue a orientação oficial de reduzir/distribuir requisições ao receber 429: [boas práticas do Mercado Livre](https://developers.mercadolivre.com.br/boas-praticas-para-usar-a-plataforma), consultada em 01/10/2026.

A instância usada pela rota impede duas importações da mesma conta ao mesmo tempo (409). Uma constraint parcial no PostgreSQL também protege a conta entre processos. O espaçamento das chamadas e a coalescência de refresh continuam locais ao processo; múltiplas instâncias exigem avaliar a cota compartilhada e rotação concorrente de tokens.

## Operação e validação

A rota manual é síncrona e responde após a conclusão; períodos longos ainda podem exceder o timeout do proxy/cliente. O novo disparo automático/incremental usa processamento em segundo plano e consulta de status, descritos em [MercadoLivreSyncService.md](MercadoLivreSyncService.md). Ambos possuem heartbeat e detecção de registros interrompidos.

Aplicar as migrações pendentes antes de usar a rota, incluindo `20261001170000_add_partial_import_success` e a migração anterior dos campos opcionais, com `npm exec prisma migrate deploy` no ambiente de banco escolhido. **As migrações não foram aplicadas ao Neon durante a implementação.**

`npm test` cobre status, contadores, fontes opcionais, isolamento de falhas, limite de concorrência, lotes, repetição, autorização HTTP e 429. As APIs são simuladas; a coordenação com parser e persistência reais usa o banco de testes em memória. Não há chamadas reais ao Mercado Livre nem gravações no banco configurado. `npm run build` verifica os tipos e gera o Prisma Client.
