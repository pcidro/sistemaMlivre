# OAuth 2.0 Magalu

Authorization Code: consentimento, callback e gravação segura de
`MarketplaceAccount`. A página Contas Integradas agora possui `Conectar Magalu`;
ela apenas navega à rota do backend, sem implementar OAuth no navegador.
Mercado Livre preservado. A importação foi acrescentada separadamente em
[MagaluImportService](../../services/imports/MagaluImportService.md).
O client HTTP acrescentado posteriormente renova tokens quando necessário;
consulte [HTTP.md](./HTTP.md) para persistência, tentativas e limites dessa renovação.

Documentação oficial consultada em 02/10/2026:
[autorização do seller](https://developers.magalu.com/docs/first-steps/create-an-application/authentication-authorization/index.html).
O consentimento usa `https://id.magalu.com/login`, `response_type=code`,
`choose_tenants=true`; a troca usa POST JSON em `https://id.magalu.com/oauth/token`.
O mesmo ID Magalu atende sandbox e produção; o ambiente seleciona a audience
esperada no token, conforme a [documentação de sandbox](https://developers.magalu.com/docs/apis/sandbox/overview/index.html).

## Configuração e deploy

1. No backend Render, manter `MAGALU_CLIENT_ID`, `MAGALU_CLIENT_SECRET`,
   `TOKEN_ENCRYPTION_KEY` e `JWT_SECRET` privados. A chave de criptografia existente
   deve ser conservada: trocá-la impede ler tokens já armazenados do Mercado Livre.
2. Usar `MAGALU_AUTH_URL=https://id.magalu.com`. No modo atual de proxy `/api`
   do frontend, configurar exatamente:
   `MAGALU_REDIRECT_URI=https://mlivrefrontend.onrender.com/api/marketplace-accounts/magalu/callback`.
   O rewrite `/api/*` existente encaminha o callback ao backend. Cadastrar essa
   mesma URL no client do IDM; não basta mudar apenas o Render.
   Se a implantação usar acesso direto ao backend em vez do proxy, usar
   `https://sistemamlivre.onrender.com/api/marketplace-accounts/magalu/callback`
   e iniciar a conexão nesse mesmo domínio, com a sessão autenticada nele.
3. Escolher `MAGALU_ENV=sandbox` e remover `MAGALU_API_URL` ou preencher
   `https://api-sandbox.magalu.com`. Para produção, usar `production` e
   `https://api.magalu.com`. A audience correspondente deve estar no client.
4. Conferir scopes e **scopes-default** do client. O ID Magalu combina os defaults
   com o parâmetro `scope`; remover permissões amplas/de escrita que não pertencem
   ao uso do sistema. O backend solicita somente:

   - `open:order-order-seller:read`
   - `open:order-delivery-seller:read`
   - `open:order-invoice-seller:read`

5. Antes de testar as rotas, aplicar a migration aditiva no ambiente de destino.
   Ela cria apenas `marketplace_oauth_states`, sem modificar contas ou tokens existentes:

   ```powershell
   # Na pasta backend, com DATABASE_URL do ambiente de destino configurada.
   npx prisma migrate deploy --config prisma7.config.ts
   npm run build
   ```

   A migration foi validada localmente, mas não aplicada ao Neon nesta tarefa.
6. Reiniciar/deployar o backend com as variáveis configuradas. Não colocar secrets
   no frontend nem no `.env.example`. No proxy, evitar logs da query do callback.

## Testar o consentimento

Depois de autenticar-se normalmente no sistema, abrir neste mesmo navegador:

`https://mlivrefrontend.onrender.com/api/marketplace-accounts/magalu/connect`

Essa URL usa o proxy já existente e também é aberta pelo botão Conectar Magalu.
O início e o callback devem usar **a mesma origem vista pelo navegador**:
um cookie emitido no domínio do frontend não é enviado ao domínio do backend.
No modo direto, ambos usam `sistemamlivre.onrender.com`. O cookie de autenticação
deve estar disponível nessa origem. Uma chamada
autenticada por Bearer também é aceita, mas o cookie de state precisa permanecer
no navegador que concluirá o consentimento. Não copiar codes ou tokens para o
frontend. No ID Magalu, selecionar a organização da loja em produção; o sandbox
também admite tenant pessoal conforme seu guia.

O retorno acontece em `/api/marketplace-accounts/magalu/callback`. Com
`FRONTEND_URL` válida (HTTPS em produção), a navegação volta a
`/marketplace-accounts?magalu=success|error` na origem configurada, sem code,
state, tokens, mensagens externas ou outras queries. A UI mostra o resultado,
limpa o parâmetro e carrega as contas sanitizadas. JSON mantém seu contrato;
sem frontend válido o callback conserva a confirmação HTML segura.
Configurar `FRONTEND_URL=https://mlivrefrontend.onrender.com` no backend e
publicar ambos para esse retorno. Isso não muda a URL cadastrada no ID Magalu.
Para testar outro fluxo após erro, iniciar novamente pelo botão de conexão.

## State e associação ao usuário

- Nonce de 32 bytes criptograficamente aleatórios; somente seu SHA-256 é salvo.
- Registro associado ao `req.user_id`, expira em dez minutos e inclui uma
  impressão da configuração do client/redirect/ambiente. Alterar esses valores
  invalida autorizações pendentes.
- Cookie HttpOnly, SameSite=Lax, Secure em produção, restrito ao callback.
  É necessário além do state recebido do ID Magalu.
- Consumo por DELETE condicional atômico antes da troca de code. Persistência em
  banco protege contra replay entre reinícios ou múltiplas instâncias.
- Callbacks repetidos, expirados, malformados ou recusados não criam contas.
  HEAD/POST recebem 405 e não consomem a autorização.
- Só o usuário iniciador recebe a conta. Reconexão não transfere uma conta de
  outro usuário e não sobrescreve seu nome/CNPJ já existentes.
- Estados expirados são limpos ao iniciar novas conexões Magalu. O limite HTTP
  é local ao processo: 30 acessos/minuto por IP identificado pelo Express.

## Identificação e tokens

`externalAccountId` recebe **o valor integral de `sub`** do access token obtido
diretamente no endpoint HTTPS oficial. Não removemos prefixos nem inferimos CNPJ.
O guia do mesmo ID Magalu para [integradoras de transporte](https://developers.magalu.com/docs/apis_logistic/carrier/first-steps/become_carrier_integrator/index.html)
documenta `sub` como tenant; a [FAQ da Open API](https://developers.magalu.com/docs/apis/faq/onboarding/index.html)
descreve o tenant como identificador do acesso autorizado. A documentação de
OAuth do seller não detalha claims de nome comercial/CNPJ nem um endpoint de
perfil para esses três scopes. Por isso o cadastro mostra o próprio identificador
oficial em `name` (campo obrigatório do schema), com `cnpj=null`. Esta associação
do subject ao acesso autorizado é a interpretação usada; não tratamos o subject
como seller fictício retornado pelo onboarding de samples.

O JWT é decodificado **apenas nesta resposta server-to-server autenticada por
TLS** para ler subject, audience e expiração. `decode()` não verifica a assinatura
do JWT; nenhum token recebido do navegador é aceito como identidade Magalu.
Não inventamos endpoint JWKS/userinfo. Para eventual validação offline de tokens
externos será necessário confirmar discovery/chaves oficiais e verificar assinatura.

O client valida resposta, scopes necessários, audience do ambiente e expiração.
`tokenExpiresAt` usa o menor prazo entre `created_at + expires_in` (ou horário de
recebimento quando ausente) e `exp`. Access/refresh são criptografados com o
`encryptToken()` existente. Não retornamos nem registramos tokens, secret, chave
de criptografia, bodies externos ou descrições de erro do provedor. Falhas de rede
e HTTP viram mensagens internas; a chamada tem timeout e não segue redirects.

## Validação e limites

Testes cobrem state válido/inválido/expirado/reutilizado, cookie, callback sem code,
recusa, troca com erro, tokens criptografados, reconexão, conflito entre usuários,
audience, expiração, métodos HTTP e migration preservando contas existentes.
Provedor simulado; consentimento real e deploy precisam ser executados por Paulo.
Antes de persistir pedidos, tratar a separação das contas/dados entre ambientes:
o mesmo tenant pode existir nos dois e o schema atual guarda uma autorização por
`platform + externalAccountId`. Trocar `MAGALU_ENV` não migra contas nem dados.
