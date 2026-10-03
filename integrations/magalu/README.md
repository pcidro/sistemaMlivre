# Client e OAuth Magalu — somente leitura

## Ambientes e testes

A [revisão completa](./REVIEW.md) registra os testes automatizados, as chamadas
negativas ao sandbox oficial e os bloqueios reais encontrados no banco configurado.

Disponível `getMagaluConfig()` com `MAGALU_ENV=sandbox|production`, host e channel
oficiais centralizados. Consulte [SANDBOX.md](./SANDBOX.md) para configuração,
onboarding do seller fictício e criação manual de pedidos pelos samples oficiais.
O OAuth está implementado; consulte [OAUTH.md](./OAUTH.md) para deploy,
rotas, segurança e limites. `MagaluClient` acrescenta transporte HTTP autenticado
e renovação segura; consulte [HTTP.md](./HTTP.md). `MagaluOrderService` consulta
pedidos em lotes sob demanda. O core e a rota de importação estão implementados;
consulte [MagaluImportService](../../services/imports/MagaluImportService.md).

Os tipos externos e o mapper puro de pedidos estão documentados em
[ORDERS.md](./ORDERS.md), com fixtures sintéticas e normalização compartilhada.
O mapper reutiliza `MagaluCustomerExtractor` para obter nome, telefone e CPF/CNPJ
diretamente de `order.customer`, sem depender de NF-e.
`MagaluDeliveryService` consulta os pacotes de um pedido, normaliza referências
e resolve o canal da venda; consulte [DELIVERIES.md](./DELIVERIES.md).
`MagaluInvoiceService` consulta as notas de cada entrega em lotes e reutiliza
o parser compartilhado para identificar o destinatário com segurança;
consulte [INVOICES.md](./INVOICES.md).
`MagaluCustomerService` mantém `order.customer` como fonte principal e consulta
as notas somente para completar campos ausentes; consulte [CUSTOMERS.md](./CUSTOMERS.md).
`MagaluOrderImportService` encaminha pedidos e notas processadas à persistência
genérica, com transação e idempotência; consulte
[persistência Magalu](../../services/imports/MagaluOrderImportService.md).
`MagaluImportService` coordena o período e expõe `POST /api/imports/magalu`,
com autenticação, batches, contadores e isolamento de falhas por pedido.

Documentação oficial consultada em 02/10/2026. OAuth e transporte HTTP genérico
estão implementados; uma migration guarda autorizações pendentes
para validar state. A consulta está conectada ao core de importação no backend;
o frontend possui conexão e listagem na página Contas Integradas, mas ainda não
oferece importação Magalu nem altera a tela de clientes.

## Variáveis do backend

| Variável | Preenchimento |
| --- | --- |
| `MAGALU_CLIENT_ID` | Client ID recebido na criação pelo IDM. |
| `MAGALU_CLIENT_SECRET` | Segredo recebido na criação; guardar no ambiente privado do backend. |
| `MAGALU_REDIRECT_URI` | URL completa do callback, idêntica à cadastrada no client. |
| `MAGALU_ENV` | `sandbox` (padrão) ou `production`. |
| `MAGALU_API_URL` | Opcional; deve corresponder ao host oficial de `MAGALU_ENV`. |
| `MAGALU_AUTH_URL` | Base `https://id.magalu.com`. Esta é uma convenção local do projeto. |

O `.env.example` começa pelo ambiente sandbox para preparação. O helper lê
`MAGALU_ENV` e confere `MAGALU_API_URL` quando informado. Não preencher secrets no arquivo de exemplo
nem usar variáveis `VITE_` para credenciais. Em produção, Paulo deverá preencher
as variáveis no Web Service do backend no Render.

A documentação usa `/login` para consentimento e `/oauth/token` para tokens no
ID Magalu. Os dois caminhos são distintos do host da API; não foi identificado
um host de autenticação exclusivo de sandbox na documentação consultada.
[Fonte: autorização do seller](https://developers.magalu.com/docs/first-steps/create-an-application/authentication-authorization/index.html).

## Scopes mínimos de negócio

| Operação | Scope |
| --- | --- |
| Consultar pedidos | `open:order-order-seller:read` |
| Consultar entregas | `open:order-delivery-seller:read` |
| Consultar dados de NF-e | `open:order-invoice-seller:read` |

Esta seleção cobre o escopo atual de leitura. Não solicitar `:write`, catálogo,
SAC ou logística adicional para consultas sem necessidade. A geração externa de
pedidos sample exige também `open:order-logistics-seller:read`, conforme o guia
[Criar Pedido](https://developers.magalu.com/docs/apis/sandbox/orders/createorder/index.html).
Essa exigência de homologação está detalhada em [SANDBOX.md](./SANDBOX.md).
O exemplo abrangente de criação inclui `apiin:all`,
mas a documentação de Pedidos não o identifica como requisito destas consultas.
Não incluí-lo preventivamente: confirmar no catálogo IDM ou com o suporte caso
haja uma exigência adicional para a conta.
[Fonte: scopes de Pedidos](https://developers.magalu.com/docs/apis/orders/overview/index.html).

Permissão para consultar notas não comprova disponibilidade de XML para todos
os pedidos. Há consulta de notas por entrega e um recurso específico de
fulfillment; validar o retorno e a disponibilidade para a operação da empresa
antes da implementação do download.
[Notas por entrega](https://developers.magalu.com/docs/apis/orders/ref/seller-v-1-get-deliveries-invoices/index.html),
[NF-e de fulfillment](https://developers.magalu.com/docs/apis/orders/ref/seller-v-1-get-invoices-fulfillment/index.html).

## URLs da aplicação

URLs atuais da implantação informada por Paulo:

| Uso no client | URL |
| --- | --- |
| `--terms-of-use` | `https://mlivrefrontend.onrender.com/termos-de-uso` |
| `--privacy-term` | `https://mlivrefrontend.onrender.com/politica-de-privacidade` |
| `--redirect-uris` (proxy `/api` atual) | `https://mlivrefrontend.onrender.com/api/marketplace-accounts/magalu/callback` |

O caminho continua atendido pelo backend: o proxy existente o encaminha.
Início e callback precisam usar o mesmo domínio para receber o cookie de state.
Para acesso direto ao backend, usar o domínio `sistemamlivre.onrender.com` em
ambos. Conferir o modo de implantação e os passos em [OAUTH.md](./OAUTH.md).

Termos e privacidade são páginas públicas, legíveis e acessíveis sem login,
apresentadas ao seller durante o consentimento. Não precisam obrigatoriamente
estar no frontend: podem estar em outro site controlado pela empresa.
[Fonte: diretrizes da aplicação](https://developers.magalu.com/docs/first-steps/create-an-application/design-guidelines/index.html).

As páginas públicas `/termos-de-uso` e `/politica-de-privacidade` foram criadas
no frontend e possuem links no login. São acessíveis sem sessão, inclusive se
o backend estiver indisponível. Os textos descrevem a centralização interna,
as fontes de dados, o acesso restrito, a retenção e o WhatsApp manual. A empresa
deve confirmar o conteúdo e completar sua identificação jurídica e canal direto
de privacidade antes de publicá-los como seus documentos definitivos.

O prefixo `/api` vem de `backend/server.ts`, que monta as rotas de contas em
`/api/marketplace-accounts`. O callback Magalu conclui autorizações válidas e
retorna o navegador à página Contas Integradas usando `FRONTEND_URL`.
Conferir acesso direto às páginas públicas
no Render, usando o rewrite `/*` para `/index.html` do Static Site.

### Rotas OAuth

- GET `/api/marketplace-accounts/magalu/connect`: exige autenticação do sistema,
  armazena hash do state com usuário/expiração/configuração, define cookie
  HttpOnly e redireciona ao consentimento oficial com seleção de tenant.
- GET `/api/marketplace-accounts/magalu/callback`: exige code/state válidos,
  cookie correspondente e state pendente. Consome o state antes da troca,
  criptografa os tokens e cria/atualiza a conta MAGALU do usuário iniciador.
- Recusa, callback incompleto, state vencido ou reutilizado: HTTP 400;
  falha de troca/retorno inválido: HTTP 502; conta de outro usuário: HTTP 409.
- Navegador com `FRONTEND_URL` válida: volta a `/marketplace-accounts` com
  `magalu=success|error`, sem tokens ou parâmetros do provedor.
- JSON ou frontend não configurado: mantém confirmação JSON/HTML segura.
- URLs longas: HTTP 414; outros métodos, incluindo HEAD: HTTP 405.
- No-store, no-referrer, CSP restritiva, bloqueio de frames e indexação;
  limite local de 30 acessos/minuto por IP do Express. Revisar proxy no Render
  para que o limite não agrupe usuários pelo IP do proxy.

Não registrar query strings do callback em logs de aplicação ou proxy.

## Criação manual pelo IDM

Baixar o [IDM oficial](https://github.com/luizalabs/id-magalu-cli/releases/latest).
Fazer login e autorizar a gestão de clients. Conferir o catálogo de scopes e
eventuais aprovações. Os comandos abaixo são exemplos para Paulo; não executados.

```powershell
.\idm.exe login
.\idm.exe client create --help
.\idm.exe scopes list
```

Modelo PowerShell: substituir URLs antes de executar. `LJ Fontes Clientes` é
uma sugestão de nome, sujeita à confirmação de Paulo.

```powershell
.\idm.exe client create `
  --name "LJ Fontes Clientes" `
  --description "Centralização interna de clientes a partir de pedidos, entregas e notas fiscais, somente leitura." `
  --terms-of-use "https://SEU-FRONTEND.com/termos-de-uso" `
  --privacy-term "https://SEU-FRONTEND.com/politica-de-privacidade" `
  --redirect-uris "https://SEU-FRONTEND.com/api/marketplace-accounts/magalu/callback" `
  --audience "https://api.magalu.com https://api-sandbox.magalu.com" `
  --scopes "open:order-order-seller:read open:order-delivery-seller:read open:order-invoice-seller:read" `
  --scopes-default "open:order-order-seller:read open:order-delivery-seller:read open:order-invoice-seller:read"
```

`description` é opcional; nome, URLs, audience e scopes são obrigatórios.
`scopes-default` é opcional: aqui repete somente as três permissões de leitura
para consentimento automático. Defaults e scopes da URL são combinados.
Conferir `AVAILABLE`/`PENDING` com `client list`; guardar UUID, ID e secret.
O secret não pode ser recuperado depois. Parâmetros de criação e atualização
possuem nomes diferentes; conferir `--help` antes de atualizar.
[Fonte: configuração do client](https://developers.magalu.com/docs/first-steps/create-an-application/create-application/index.html).

O nome deve ter de 4 a 20 caracteres e identificar a empresa/serviço sem
incorporar marcas do grupo Magalu. A sugestão acima tem 17 caracteres.
[Fonte: nomes de aplicação](https://developers.magalu.com/docs/first-steps/create-an-application/design-guidelines/index.html).

## Checklist externo de Paulo

- Definir nome da aplicação e domínios HTTPS do frontend/backend.
- Preparar e publicar termos e privacidade com informações reais da empresa.
- Cadastrar o client pelo IDM e conferir seus parâmetros e permissões.
- Preencher as variáveis privadas e `MAGALU_ENV`; conservar também o UUID para gestão IDM.
- Confirmar o acesso à organização da loja no ID Magalu. No consentimento
  de produção, selecionar a organização com `choose_tenants=true`.
- Para sandbox, configurar sua audience e o onboarding/canal do ambiente antes
  dos testes; isso é uma operação externa separada, não executada nesta tarefa.
- Aplicar a migration de state e realizar o fluxo OAuth conforme [OAUTH.md](./OAUTH.md).

As audiences propostas correspondem aos dois hosts de Marketplace. Para usar
somente um ambiente, cadastrar somente seu host. `services.magalu.com` é a API
complementar e não foi selecionada para o escopo atual.
[Fonte: ambientes](https://developers.magalu.com/docs/first-steps/environment/index.html).

A página geral de ambientes ainda informa sandbox em desenvolvimento, mas há
documentação específica de Sandbox Pedidos. A preparação contempla o host;
Paulo deverá confirmar acesso, dados de teste e disponibilidade da conta.
O guia de sandbox documenta onboarding e canal
`5f62650a-0039-4d65-9b96-266d498c03bd`; a geração externa de pedidos de teste está
documentada em [SANDBOX.md](./SANDBOX.md), sem executar chamadas nesta etapa.
[Sandbox Pedidos](https://developers.magalu.com/docs/apis/sandbox/orders/),
[onboarding de sandbox](https://developers.magalu.com/docs/development-guide/sandbox/index.html).

## Verificação realizada

Conferidos os nomes de variáveis, ambientes, hosts, channels e scopes de leitura.
Nenhum client foi criado, nenhum consentimento real realizado e nenhum secret
real foi adicionado. OAuth é testado com respostas simuladas do provedor e
persistência isolada; a migration é validada em PostgreSQL local via PGlite.
