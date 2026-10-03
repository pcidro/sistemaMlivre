# Client HTTP Magalu

`MagaluClient` recebe a conta carregada no backend e disponibiliza `get<T>()` e
`request<T>()`. Não adiciona rotas, consultas de pedidos, frontend ou migrations.
O serviço chamador continua responsável por autorizar o usuário antes de carregar
a conta; o client confere plataforma, atividade, dono e identidade no banco.

## Configuração e respostas

- A base vem exclusivamente de `getMagaluConfig()`: sandbox ou produção.
- O caminho deve ser relativo ao host oficial e começar com `/`. URLs externas,
  destinos de outro ambiente e redirects são bloqueados.
- `Authorization: Bearer` sempre usa o token descriptografado no backend. Headers
  fornecidos pelo chamador não substituem Authorization ou X-Request-ID; Cookie
  e Host são removidos. Não há tokens nas respostas públicas do sistema.
- O retorno interno contém `{ data, status, requestId }`. JSON é o padrão;
  `responseType: "text"` permite conteúdo textual. HEAD e HTTP 204 retornam null.
- Não há logs de bodies, URLs com parâmetros, credenciais ou dados pessoais.
  Erros carregam mensagem interna, código, status do provedor, UUID de diagnóstico
  e espera necessária, sem anexar o Response ou o body externo.

O client gera um UUID por tentativa e preserva o UUID retornado em X-Request-ID.
Valores fora do formato UUID são descartados, usando o identificador gerado.
Isso segue a [documentação oficial de identificação de requisições](https://developers.magalu.com/docs/development-guide/request-identifier-x-request-id/index.html).

## Renovação e persistência

O fluxo oficial usa POST em `https://id.magalu.com/oauth/token` com formulário
`application/x-www-form-urlencoded`: `grant_type=refresh_token`, `client_id`,
`client_secret` e `refresh_token`.
[Fonte: ID Magalu](https://developers.magalu.com/docs/first-steps/create-an-application/authentication-authorization/index.html).

`MagaluTokenService` reutiliza a validação de resposta já utilizada no OAuth:
subject, audience, scopes e expiração. O menor prazo entre expiração persistida
e `exp` do JWT determina a validade; a margem preventiva é de 60 segundos.
Expiração desconhecida também exige renovação. A leitura do JWT continua restrita
ao token de origem oficial recebido pelo backend ou ao armazenamento criptografado.

Renovações locais compartilham uma promessa por conta. No PostgreSQL, uma
transação bloqueia a linha com `FOR UPDATE`, relê as credenciais e só então decide
se a renovação ainda é necessária. Isso também coordena processos diferentes.
A chamada OAuth tem timeout de 15 segundos; a transação tem timeout de 25 segundos.
Uma única atualização salva access token, refresh token e expiração. Os dois tokens
são protegidos com `encryptToken()`; o refresh anterior permanece quando o ID não
retorna um novo. Nunca se limpa o refresh antes da gravação.

O novo access token só é utilizado depois do COMMIT. Se UPDATE/COMMIT falhar, o
banco preserva o par anterior e o resultado novo fica criptografado em memória
para nova tentativa de gravação. A próxima chamada pelo mesmo serviço reutiliza
esse resultado, sem repetir OAuth com um refresh possivelmente rotacionado.
Uma reconexão externa substituindo tokens prevalece sobre a recuperação pendente.

**Limite de recuperação:** não existe transação distribuída com o ID Magalu. Se o
provedor rotacionar o refresh e o processo encerrar antes de persistir o novo par,
o resultado mantido em memória pode se perder; será necessário reconectar caso o
refresh anterior tenha sido invalidado. O mesmo vale para timeout de rede quando
o servidor renovou, mas sua resposta não chegou. Por isso não repetimos refresh
automaticamente em erros de rede/HTTP. Uma garantia de recuperação após queda
exigiria um mecanismo durável adicional e não foi presumida nesta implementação.

## HTTP, limites e tentativas

| Status externo | Tratamento |
| --- | --- |
| 400 | Parâmetros recusados; sem retry. |
| 401 | GET/HEAD tenta renovar uma vez e repetir; segundo 401 exige reconexão. |
| 403 | Permissão ausente; sem renovação ou retry. |
| 404 | Recurso ausente; sem retry. |
| 429 | Pausa compartilhada pela conta e Retry-After, se fornecido. |
| 500/502/503/504 | Retry limitado em leituras; erro seguro se persistir. |

Mensagens externas e detalhes de negócio não são refletidos.
[Contrato oficial de erros](https://developers.magalu.com/docs/development-guide/error-structure/index.html).

GET/HEAD permitem duas tentativas adicionais por padrão; `maxRetries` pode variar
de zero a três. Falhas de rede também podem ser repetidas para essas leituras.
POST/PUT/PATCH/DELETE são suportados como transporte genérico, sem repetição
automática: nenhum adapter de escrita foi criado e nenhum scope foi ampliado.

O limiter é compartilhado entre clients no processo, por ambiente e tenant;
o intervalo inicial é de 250ms entre chamadas, com pausa em falhas temporárias.
Sem Retry-After, 429 aguarda pelo menos dois segundos. Outras falhas temporárias
usam espera crescente de 500ms. Retry-After pode ser segundos ou HTTP-date e nunca
é reduzido para tentar antes do prazo. Se a pausa ultrapassar o orçamento de
60 segundos da consulta, retorna erro com o prazo restante em vez de bloquear
indefinidamente. O timeout por tentativa HTTP é de até 15 segundos e cancelamento
do chamador encerra as tentativas.

Os limites oficiais variam por módulo e seller. O intervalo inicial é conservador
para os três scopes de leitura atuais; o controle agregado entre várias instâncias
ou outros integradores exige coordenação adicional. O client trata 429 e conserva
a pausa, mas não presume um limite universal para futuras APIs.
[Rate limit oficial](https://developers.magalu.com/docs/development-guide/rate-limit/index.html).

## Validação

Mocks cobrem tokens válidos/expirados, refresh com e sem rotação, falhas de refresh,
falha de COMMIT com recuperação, concorrência, 401, 403, 429, 500/503, Retry-After,
destinos indevidos, resposta inválida e proteção dos identificadores de diagnóstico.
Os testes de persistência verificam bloqueio de linha, atualização conjunta e
retorno somente após commit. Não são realizadas chamadas reais à Magalu.
