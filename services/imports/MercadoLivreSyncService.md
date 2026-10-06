# Sincronização automática após OAuth

## Auditoria anterior à alteração

| Estado | Constatação |
| --- | --- |
| Pronto | OAuth com state assinado, consulta `/users/me`, vínculo ao usuário iniciador, tokens AES-256-GCM e expiração. Refresh automático com coalescência na instância. |
| Pronto | Busca paginada em janelas, limitação de chamadas, retries de 401/429/5xx, destinatário/pedido/envio, documento fiscal e NF-e como complemento. Campos opcionais permanecem nulos. |
| Pronto | Persistência serializável de cliente/pedido/itens/nota, chaves únicas de pedido e NF-e, atualização sem duplicar e isolamento por usuário. |
| Parcial | Import possui contadores, lotes e isolamento de erros, mas só era disparado manualmente e aguardado pela requisição. Frontend só conhecia resultados da sessão. |
| Faltando | Disparo após OAuth, processamento fora do callback, período inicial configurável, cursor de sucesso, leitura de status e polling. |
| Inconsistente | O bloqueio de importações só protegia uma instância. A verificação de dono no OAuth precedia uma escrita sem a mesma condição. Ambos foram reforçados. |

Não existe uma classe `MercadoLivreClient`: as responsabilidades estão nos clients/serviços OAuth, token, pedido, destinatário e NF-e existentes. Nenhum adapter externo foi reimplementado. Endpoints confirmados na documentação oficial de [pedidos](https://developers.mercadolivre.com.br/pt_br/produto-autenticacao-autorizacao/gerenciamento-de-vendas) e [notas fiscais](https://developers.mercadolivre.com.br/pt_br/convivencia-me1-me2/obtendo-nota-fiscal).

## Disparo e execução

O callback valida state/code, troca tokens, consulta a conta, criptografa e persiste. Somente depois registra `Import(PROCESSING)` e agenda o importador existente com `setImmediate`. Redireciona para `FRONTEND_URL/marketplace-accounts?mercadolivre=success&import_id=...`, sem aguardar pedidos. Erro ao agendar preserva o sucesso OAuth e acrescenta `sync_error=start_failed`. Erro de processamento nunca desconecta a conta.

O registro preparado é passado ao `ImportRunner`, que o reutiliza, sem criar outra importação. Mantém lotes de 20, concorrência 3, paginação e persistência atuais. Singleton compartilhado com a rota manual conserva o limite de chamadas e a coordenação de refresh. Uma constraint parcial PostgreSQL permite somente um `PROCESSING` por conta ML, incluindo importações manuais. Reconexão reutiliza o registro ativo.

NF-e ausente retorna null como antes. Se a consulta/XML complementar falhar, o importador opta pelo fallback do extrator existente: salva dados do destinatário já obtidos e contabiliza o erro, sem inventar campos. Outros consumidores mantêm o comportamento anterior do extrator. Erros de consulta obrigatória do destinatário ou de persistência continuam isolados por pedido.

## Período e avanço

`MERCADO_LIVRE_INITIAL_SYNC_DAYS`: inteiro de 1 a 365; padrão **90**. É uma janela inicial moderada, sem importar o histórico inteiro. O serviço de pedidos continua respeitando a retenção de 12 meses da API. Datas são armazenadas no Import.

Após `SUCCESS`, `MarketplaceAccount.lastSyncAt` recebe o **dateTo consultado**, nunca `finishedAt`: usar a conclusão pularia pedidos criados durante o processamento. Próximas sincronizações consultam dessa data menos uma hora até agora; a sobreposição permite repetir a fronteira com a persistência idempotente. Cursor só cresce, e apenas para a conta/dono ativos.

`PARTIAL_SUCCESS`/`ERROR` não avançam o cursor. Antes do primeiro sucesso, a nova tentativa mantém `dateFrom` da anterior, mesmo dias depois. Importações manuais de períodos arbitrários não avançam esse cursor. Entrar na aplicação apenas consulta status; não inicia nova busca. Reconectar ou clicar em sincronizar inicia o próximo intervalo.

Não acompanha alterações ou notas fiscais disponibilizadas muito depois para pedidos antigos fora da janela de sobreposição. Esses casos exigem reimportação manual do período; notificações/webhooks ficam fora desta tarefa. Clientes de pedidos distintos sem identificação suficiente não são fundidos por suposição. O modelo existente também não permite compartilhar uma mesma Invoice entre vários Orders; o conflito continua explícito.

## Leitura, segurança e recuperação

- `GET /api/imports`: última importação de cada conta ML ativa do usuário; não é histórico completo de todas as plataformas.
- `GET /api/imports/:id`: resumo ML do usuário, 404 idêntico para inexistente ou de outro dono.
- `POST /api/imports/mercadolivre/sync`: `{ marketplaceAccountId }`; sessão determina o usuário, resposta 202. Reutiliza job ativo ou cria nova sincronização.

Todos exigem autenticação. DTO seleciona apenas IDs, datas, status e contadores. Nenhum token, nome/telefone/documento de cliente, XML ou erro bruto aparece no resumo/log. Rotas manuais ML/Magalu mantêm contrato anterior.

Heartbeat atualiza `Import.updatedAt` a cada 30 segundos durante o processamento. Leituras ou novo disparo marcam como ERROR registros sem atualização há dez minutos; preservam dados e cursor. A finalização exige que o registro ainda esteja PROCESSING para impedir que uma execução antiga sobrescreva um cancelamento. A tentativa pode ser reiniciada pelo botão sem repetir OAuth.

Não há fila externa nem reinício automático do trabalho após queda do processo. Render precisa manter o backend disponível. Deploy/restart pode interromper o trabalho: após expirar o heartbeat, a nova tentativa repete o intervalo incompleto com idempotência. PostgreSQL indisponível pode adiar a marcação de ERROR; leituras não inventam sucesso.

## Frontend

Provider consulta últimas execuções ao montar a área autenticada e ao voltar à janela. Durante PROCESSING consulta os IDs a cada 3s; falha de leitura mostra erro recuperável e tenta após 5s. Para ao concluir e aborta requests ao sair da área autenticada. Não utiliza localStorage, WebSocket ou tokens de marketplace.

Contas Integradas e Importações mostram conexão separada do resultado da sincronização, contadores, link para clientes e retry/incremental. A lista de clientes recarrega quando contadores/status mudam, respeitando seus filtros e paginação. O histórico manual da sessão permanece separado.

## Publicação e testes

Arquivos desta alteração:

- Backend: `.env.example`, `package.json`, `prisma/schema.prisma`, migration `20261006120000_add_mercadolivre_sync`, `mercadoLivreOAuthService.ts`, `mercadoLivreOAuthController.ts`, `mercadoLivreImportController.ts`, novo `mercadoLivreSyncController.ts`, `importRoutes.ts`, `ImportRepository.ts`, `ImportRunner.ts`, `MercadoLivreImportService.ts`, novo `MercadoLivreSyncService.ts` e `CustomerExtractionService.ts`.
- Testes backend: `mercadoLivreOAuthController.test.ts`, `ImportRepository.test.ts`, `MercadoLivreImportService.test.ts`, novos `MercadoLivreSyncService.test.ts`, `mercadoLivreSyncRoutes.test.ts` e `mercadoLivreSyncMigration.test.ts`.
- Frontend: `ImportsProvider.tsx`, `useImports.ts`, novo `useMercadoLivreSync.ts`, `importsService.ts`, novo `MercadoLivreSyncStatus.tsx`, `MarketplaceAccountsPage.tsx`, `ImportsPage.tsx`, `useCustomers.ts`, `useResource.ts` e espaçamento do novo card em `styles/components.css`.
- Testes/documentação frontend: `importsService.test.ts`, fixture E2E, novo `mercadoLivreSync.spec.ts` e `docs/IMPORTS.md`. Documentação backend: este arquivo e `MercadoLivreImportService.md`.

Aplicar `20261006120000_add_mercadolivre_sync` com `npm exec prisma migrate deploy` no ambiente desejado **antes de iniciar o novo backend**. A migration preserva todos os registros; havendo vários PROCESSING antigos ML na mesma conta, finaliza os antigos como ERROR e mantém o mais recente antes de criar a constraint. Não altera registros Magalu. Depois compilar e publicar backend/frontend. Configurar a janela no backend Render se quiser mudar o padrão. Não mudar callback OAuth ou credenciais para ativar a sincronização.

A migration foi validada em PostgreSQL embarcado de teste (PGlite); não aplicada ao Neon nesta tarefa. Testes usam respostas fictícias, sem Mercado Livre real ou banco configurado: callback e falhas de OAuth/persistência; agendamento não bloqueante; cursor/período/reconexão/erro parcial; migration/constraint; acesso HTTP por dono; importação/extrator/refresh/429/500/idempotência existentes. Testes de navegador verificam progresso, reload, atualização de clientes, sucesso e retry, preservando fluxos Magalu/manuais. Concorrência com vários processos no Neon continua sendo uma verificação operacional recomendada.

Validação em 06/10/2026: 649 testes backend, 30 testes frontend e 18 cenários de navegador passaram. Schema Prisma validado, backend compilado em diretório separado e frontend compilado/lint sem erros. Layout da sincronização conferido em desktop e celular. Nenhuma chamada autenticada real aos marketplaces ou gravação no Neon foi feita.
