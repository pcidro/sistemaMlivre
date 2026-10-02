# Preparação do client Magalu — somente leitura

Documentação oficial consultada em 02/10/2026. Esta etapa acrescenta apenas
configuração de exemplo e documentação. Posteriormente foram acrescentadas
páginas públicas e uma rota de callback segura de preparação, descritas abaixo.
O fluxo OAuth, consultas externas e mudanças de schema continuam fora desta etapa.

## Variáveis do backend

| Variável | Preenchimento |
| --- | --- |
| `MAGALU_CLIENT_ID` | Client ID recebido na criação pelo IDM. |
| `MAGALU_CLIENT_SECRET` | Segredo recebido na criação; guardar no ambiente privado do backend. |
| `MAGALU_REDIRECT_URI` | URL completa do callback, idêntica à cadastrada no client. |
| `MAGALU_API_URL` | `https://api.magalu.com` em produção; `https://api-sandbox.magalu.com` em homologação. |
| `MAGALU_AUTH_URL` | Base `https://id.magalu.com`. Esta é uma convenção local do projeto. |

O `.env.example` começa pelo host de sandbox para preparação. Nenhuma variável
Magalu é consumida pelo código atual. Não preencher secrets no arquivo de exemplo
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
SAC ou logística adicional. O exemplo abrangente de criação inclui `apiin:all`,
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

Paulo precisa definir os domínios reais. Exemplos de URLs planejadas:

| Uso no client | URL |
| --- | --- |
| `--terms-of-use` | `https://SEU-FRONTEND.com/termos-de-uso` |
| `--privacy-term` | `https://SEU-FRONTEND.com/politica-de-privacidade` |
| `--redirect-uris` | `https://SEU-BACKEND.com/api/marketplace-accounts/magalu/callback` |

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
`/api/marketplace-accounts`. O callback Magalu existe como rota de preparação,
mas ainda não conclui autorizações. Conferir acesso direto às páginas públicas
no Render, usando o rewrite `/*` para `/index.html` do Static Site.

### Comportamento do callback nesta etapa

- GET sem parâmetros: HTTP 200, informando que a integração está em preparação.
- Retorno malformado, campos repetidos, incompatíveis ou inesperados: HTTP 400.
- `code` e `state`, ou `error` e `state`, estruturalmente válidos: HTTP 501.
  Nenhum código é aceito como autorização, trocado, persistido ou registrado em log.
- URL acima de 8192 caracteres: HTTP 414; métodos diferentes de GET/HEAD: HTTP 405.
- Limite local de 30 requisições por minuto por IP identificado pelo Express;
  excesso recebe HTTP 429. Atrás de proxy, revisar a configuração de `trust proxy`
  da implantação antes de habilitar o fluxo real. O limite é local ao processo.
- Respostas HTML ou JSON conforme Accept, sem refletir os parâmetros externos,
  sem redirecionamentos e sem cookies de sessão.
- No-store, no-referrer, CSP restritiva, bloqueio de frames e indexação.

Não há início de OAuth nem validação de autenticidade do state nesta etapa.
Por isso TODOS os retornos com parâmetros ficam bloqueados. O próximo fluxo
deverá gerar state vinculado ao usuário/sessão, validar expiração e uso único,
tratar a recusa do seller e somente então trocar o código e salvar a conta.
A validação estrutural atual não substitui essa proteção. Não registrar query
strings do callback em logs de aplicação ou proxy.

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
  --redirect-uris "https://SEU-BACKEND.com/api/marketplace-accounts/magalu/callback" `
  --audience "https://api.magalu.com https://api-sandbox.magalu.com" `
  --scopes "open:order-order-seller:read open:order-delivery-seller:read open:order-invoice-seller:read" `
  --scopes-default "open:order-order-seller:read open:order-delivery-seller:read open:order-invoice-seller:read"
```

`description` é opcional; nome, URLs, audience e scopes são obrigatórios.
`scopes-default` é opcional: aqui repete somente as três permissões de leitura
para consentimento automático. Defaults e scopes da futura URL são combinados.
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
- Preencher as cinco variáveis privadas; conservar também o UUID para gestão IDM.
- Confirmar o acesso à organização da loja no ID Magalu. No futuro consentimento
  de produção, selecionar a organização com `choose_tenants=true`.
- Para sandbox, configurar sua audience e o onboarding/canal do ambiente antes
  dos testes; isso é uma operação externa separada, não executada nesta tarefa.
- Aguardar a implementação do fluxo OAuth antes de testar autorização.

As audiences propostas correspondem aos dois hosts de Marketplace. Para usar
somente um ambiente, cadastrar somente seu host. `services.magalu.com` é a API
complementar e não foi selecionada para o escopo atual.
[Fonte: ambientes](https://developers.magalu.com/docs/first-steps/environment/index.html).

A página geral de ambientes ainda informa sandbox em desenvolvimento, mas há
documentação específica de Sandbox Pedidos. A preparação contempla o host;
Paulo deverá confirmar acesso, dados de teste e disponibilidade da conta.
O guia de sandbox documenta onboarding e canal
`5f62650a-0039-4d65-9b96-266d498c03bd`; não gerar pedidos nem ampliar permissões
de escrita neste client apenas para preparar testes.
[Sandbox Pedidos](https://developers.magalu.com/docs/apis/sandbox/orders/),
[onboarding de sandbox](https://developers.magalu.com/docs/development-guide/sandbox/index.html).

## Verificação realizada

Conferidos os cinco nomes de variáveis, hosts e scopes exclusivamente de leitura.
Nenhum client foi criado, nenhum consentimento realizado e nenhum secret real
foi adicionado. A rota de preparação é testada sem banco nem chamadas Magalu;
as páginas públicas têm teste de acesso sem sessão/backend e responsividade.
