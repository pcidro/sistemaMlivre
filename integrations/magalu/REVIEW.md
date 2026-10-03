# Revisão da integração Magalu — 02/10/2026

A implementação passou nos testes automatizados, mas **a validação autenticada
no sandbox ainda não foi concluída**. O banco indicado pelo `.env` possui quatro
migrations pendentes e nenhuma conta Magalu ativa vinculada a um usuário. O
OAuth não pode iniciar enquanto faltar sua tabela de state. Não houve criação
de pedidos, onboarding, alteração de registros ou execução de migrations nesse
banco. Nenhuma funcionalidade nova foi adicionada à aplicação.

## Testes executados

| Verificação | Resultado e alcance |
| --- | --- |
| Backend completo: `npm test` | **626 aprovados**, zero falhas ou testes ignorados. Inclui regressão Mercado Livre, integração Magalu, rotas autenticadas, normalização, parser, persistência simulada e migrations em PGlite. |
| Backend: `npx tsc --noEmit` | Aprovado. Sem regenerar `dist` ou aplicar migrations. |
| Frontend: `npm test` | **29 aprovados**, zero falhas. |
| Frontend: `npm run test:e2e` | **37 aprovados** no navegador com API simulada: contas, OAuth na UI, importações, clientes, dashboard, erros, sessão e responsividade. |
| Frontend: build e lint | Aprovados. |
| Credenciais configuradas | Nenhum valor sensível configurado foi encontrado em `.env.example` do backend/frontend ou nos arquivos compilados do frontend. A conferência não imprimiu valores. Isso não é uma auditoria de histórico Git ou das variáveis/logs do Render. |
| Banco configurado | Consultas de leitura a contas e metadados realizadas; achados abaixo. Nenhum dado pessoal foi exibido. |

### Cobertura funcional automatizada

Todos os cenários abaixo usam transporte mockado e fixtures sintéticas, sem
pedidos, XMLs, documentos, pessoas ou credenciais reais em testes automatizados.

| Área | Cenários verificados |
| --- | --- |
| OAuth/connect | Autenticação obrigatória; `req.user_id`; state aleatório criptográfico, hash no banco, cookie HttpOnly/Secure/SameSite; URL oficial, `response_type=code`, `choose_tenants=true` e três scopes de leitura. |
| OAuth/callback | State válido, inválido, ausente, expirado e reutilizado; cookie incompatível; ausência/erro de code; parâmetros repetidos/incompatíveis; recusa de consentimento; falha na troca; persistência criptografada; conflito de dono da conta; resposta HTML/JSON e redirect sanitizado sem tokens. |
| Tokens/client | Access válido/expirado, margem preventiva e expiração JWT; refresh oficial em formulário; rotação e ausência de novo refresh; falha de refresh; falha de commit com recuperação em memória; concorrência; validação de tenant/audience e conta ativa; tokens usados somente após salvar. |
| HTTP | 400, 401, 403, 404, 429, 500 e 503; renovação após 401 uma única vez; retries finitos; Retry-After em segundos/data; pausa compartilhada no processo; timeout, cancelamento, destino externo e respostas inválidas. Erros não incluem body externo. |
| Pedidos | Uma/várias páginas, página curta/vazia, offsets, redução de limite, repetição de página, falha intermediária, intervalo ISO 8601 e fuso; mapper obrigatório; pedido inválido isolado sem cancelar os seguintes. |
| Cliente | CPF/CNPJ, campos parciais/ausentes, nome, telefone por componentes, DDI já presente, prioridade mobile/residential/comercial, normalizadores compartilhados e ausência de documento/telefone. |
| Entregas | Uma/várias/nenhuma entrega; canal sandbox oficial; canal real de produção obtido da API; validação de conta/pedido/canal; paginação; 404 e 429. |
| NF-e | CPF/CNPJ, telefone ausente, XML inválido, nota ausente, múltiplas notas/páginas, destinatário incompatível/ambíguo, chave divergente, status e data; parser compartilhado; XML descartado após extração. |
| Fallback | Pedido prevalece; NF-e completa somente campos ausentes; nenhuma chamada fiscal se cliente já estiver completo; falha fiscal preserva dados válidos e não inventa destinatário. |
| Import/persistência | Primeiro import, reimportação, duplicação entre páginas, duas contas com mesmo código, cliente sem documento/telefone/NF-e, NF-e inválida, rollback e conflitos; pedidos/clientes/itens/notas sem duplicação indevida; cinco contadores e SUCCESS/PARTIAL_SUCCESS/ERROR. |
| Autorização/segurança | Conta de outro usuário/inativa/plataforma errada rejeitada antes de APIs ou escrita; reconexão não transfere conta; SELECT sanitizado de contas; rotas/resumos não retornam tokens, secret, chave ou XML; erro interno não imprime payload sensível. |

Foram acrescentados **15 testes de regressão** nesta revisão: dois do tratamento
de erros, um de descarte de resposta OAuth e doze do core de importação. Os novos testes de importação exercitam o
client, os serviços, o mapper, o parser e a persistência compartilhada com HTTP
e banco de testes, incluindo 401/403/429/500/503 antes e após uma página salva.
Também verificam XML inválido com processamento do próximo pedido e reimportação
sem documento, telefone ou nota. Testes de armazenamento em memória não comprovam
locks/isolamento de transações de múltiplas instâncias no PostgreSQL real.

## Testes reais no sandbox oficial

As primeiras tentativas no ambiente restrito não alcançaram os serviços externos.
Com acesso de rede permitido, foram realizadas as seguintes chamadas reais:

| Chamada | Resultado |
| --- | --- |
| GET `https://api-sandbox.magalu.com/seller/v1/orders?_offset=0&_limit=1`, sem Bearer | **401**, proteção de autenticação confirmada. |
| GET `https://api-sandbox.magalu.com/seller/v1/deliveries?_offset=0&_limit=1`, sem Bearer e com canal oficial | **401**, proteção de autenticação confirmada. |
| POST `https://id.magalu.com/oauth/token`, code deliberadamente inválido e configuração local do client | **400**, código recusado e erro sanitizado pelo client da aplicação. Nenhuma conta criada. |

Nenhum `X-Request-ID` válido foi retornado nessas respostas. Bodies, secrets e
tokens não foram impressos ou colocados neste relatório. Esses três testes
**negativos** não validam consentimento, leitura autorizada, refresh real,
onboarding, seller fictício, samples, deliveries autorizadas ou XML real.

O banco retornou **zero contas Magalu ativas com usuário vinculado**. Não existe
token autorizado disponível para os passos positivos; Client ID/secret sozinhos
não substituem consentimento. Por isso nenhum pedido fictício foi criado.

## Problemas encontrados e correções

**Corrigido — mensagem interna sensível nos logs.** `errorHandler.ts` imprimia
`err.message` para erros inesperados. Mensagens de drivers/provedores podem conter
tokens, secrets ou dados pessoais. Agora registra somente a indicação genérica;
mantém as respostas públicas existentes. Dois testes protegem logs e respostas.
Nenhuma implementação específica do Mercado Livre foi reescrita.

**Corrigido — resposta de erro OAuth sem descarte explícito.** A troca de code
rejeitado lançava erro sem cancelar o body externo. Agora descarta o stream,
como o refresh e o client HTTP já fazem, evitando manter a resposta pendente.
O teste confirma descarte sem leitura/exposição do conteúdo e sem criar conta.

**Pendente — banco anterior ao schema atual.** A leitura do histórico confirmou:

| Migration não aplicada | Consequência |
| --- | --- |
| `20261001160000_allow_missing_imported_customer_name_and_price` | Campos continuam obrigatórios no banco para dados que a integração pode não fornecer. |
| `20261001170000_add_partial_import_success` | O enum real ainda não suporta PARTIAL_SUCCESS. |
| `20261001180000_add_customer_document` | As colunas `customers.document` e `customers.document_type` ainda não existem. |
| `20261002120000_add_marketplace_oauth_states` | A tabela `marketplace_oauth_states` ainda não existe; connect não consegue guardar state. |

Isso impede considerar o deploy pronto para OAuth/importação. As migrations
existentes foram testadas localmente; **não foram aplicadas ao banco externo**.
A conferência vale para o `DATABASE_URL` local usado nesta revisão; as variáveis
do Render não foram lidas, então não se presume que apontem para a mesma base.

**Pendente — isolamento sandbox/produção.** `MarketplaceAccount` não guarda o
ambiente e é única por `platform + externalAccountId`; Order é único por
`marketplaceAccountId + externalOrderId`. Alternar MAGALU_ENV na mesma base não
separa autorizações nem pedidos. Tokens com ambas as audiences também não fazem
essa separação. A mitigação operacional atual é usar banco e autorização de
homologação separados. Não foi criada funcionalidade ou alteração de schema
para separar ambientes nesta tarefa.

**Limites existentes, sem novos mecanismos nesta revisão.** O limiter e o
bloqueio de importação são locais ao processo. Refresh usa lock de conta no
PostgreSQL, mas o novo refresh retido após falha de commit pode ser perdido se
o processo morrer antes da gravação. Timeout após rotação no provedor também
pode exigir reconexão. Não se promete transação distribuída com o ID Magalu.
Autorização interna é por `userId`; o domínio atual não possui entidade Empresa
separada. Não há garantia adicional de isolamento por empresa além desse vínculo.

## O que falta validar antes de produção

1. Preparar base de homologação isolada e aplicar as migrations existentes no
   banco escolhido. O arquivo de configuração deste projeto é `prisma7.config.ts`:

   ```powershell
   npx prisma migrate status --config prisma7.config.ts
   npx prisma migrate deploy --config prisma7.config.ts
   ```

   Conferir previamente qual DATABASE_URL está configurada. Não usar reset,
   `db push` ou migrations destrutivas como substituto de deploy.
2. Confirmar no ID Magalu audience de sandbox e scopes/defaults: os três scopes
   da aplicação são de leitura. Defaults do client são somados à URL de
   consentimento; não manter permissões de escrita desnecessárias.
3. Conectar pelo OAuth com um tenant de testes, conferir o callback cadastrado,
   a origem do navegador/proxy e a chegada do cookie de state. Executar consentimento,
   callback válido e refresh real sem expor tokens ao navegador.
4. Fazer `PUT /v1/samples/onboarding` no host sandbox com o canal oficial
   `5f62650a-0039-4d65-9b96-266d498c03bd`; usar o seller devolvido pela API.
5. Cadastrar/selecionar um SKU fictício no canal e criar pedidos pela API oficial
   `POST /v1/samples/orders`. Ela exige também `open:order-logistics-seller:read`;
   preparar consentimento/client de homologação apropriado, sem ampliar
   automaticamente o client de leitura da aplicação. Detalhes em [SANDBOX.md](./SANDBOX.md).
6. Validar payloads e paginação reais, períodos/fuso, CPF/CNPJ, phones, deliveries,
   notas aprovadas e XMLs fictícios oficiais. Testar reimportação em PostgreSQL
   de homologação e refresh/conflitos com duas instâncias, usando métricas/logs
   sanitizados. Não forçar erros por volume de requests contra a plataforma.
7. Em produção, confirmar base/conta/autorização corretas, audience/host de produção,
   configuração efetiva do Render, HTTPS/proxy/cookies e migrations. Fazer importação
   pequena e controlada para conferir os dados disponíveis da loja e a idempotência.
   Rever logs do Render/proxy para não registrar query de callback, tokens ou XMLs.

## Evidências e documentação

Scripts de diagnóstico, fora das rotas e da execução normal da aplicação:

- `npx tsx scripts/magaluReviewPrerequisites.ts`: apenas leitura de configuração,
  metadados e elegibilidade de contas; nunca imprime tokens, tenant ou dados pessoais.
- `npx tsx scripts/magaluReviewLive.ts`: testes negativos no sandbox e code inválido
  no endpoint oficial. Não cria samples, não consulta produção nem altera o banco.

Documentação oficial atual consultada, incluindo os schemas públicos carregados
pelas páginas de pedidos, entregas e NF-e, sem executar o JavaScript do provedor:

- [OAuth e refresh ID Magalu](https://developers.magalu.com/docs/first-steps/create-an-application/authentication-authorization/index.html).
- [Client, audiences e scopes-default](https://developers.magalu.com/docs/first-steps/create-an-application/create-application/index.html).
- [Sandbox, canal e onboarding](https://developers.magalu.com/docs/apis/sandbox/overview/).
- [Criação oficial de pedidos fictícios](https://developers.magalu.com/docs/apis/sandbox/orders/createorder/index.html).
- [GET /seller/v1/orders](https://developers.magalu.com/docs/apis/orders/ref/seller-v-1-get-order-list/index.html).
- [GET /seller/v1/deliveries](https://developers.magalu.com/docs/apis/orders/ref/seller-v-1-get-deliveries-list/index.html).
- [GET /seller/v1/deliveries/:id/invoices](https://developers.magalu.com/docs/apis/orders/ref/seller-v-1-get-deliveries-invoices/index.html).

Os contratos conferidos correspondem aos filtros, tipos de telefone/documento,
paginação e headers usados pelos adapters. Isso não substitui a homologação
positiva do seller/tenant e dos dados retornados pela API com autorização real.
