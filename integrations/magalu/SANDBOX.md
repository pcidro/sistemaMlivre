# Magalu: sandbox e produção

Documentação oficial consultada em 02/10/2026. Configuração e OAuth disponíveis;
consulte [OAUTH.md](./OAUTH.md). Consulta em lotes disponível em `MagaluOrderService`
(ver [ORDERS.md](./ORDERS.md)). Importação/persistência de pedidos, onboarding automático,
cadastro de produtos e geração de pedidos pela aplicação continuam fora do escopo.

## 1. Ativar sandbox

No `.env` privado do backend ou em Environment do Web Service no Render:

```env
MAGALU_ENV=sandbox
MAGALU_API_URL=https://api-sandbox.magalu.com
MAGALU_AUTH_URL=https://id.magalu.com
```

Salvar e redeployar/reiniciar o backend após mudar variáveis. Os futuros serviços
devem obter o host e o canal exclusivamente por `getMagaluConfig()`, sem escolher
URLs por conta própria:

```ts
import { getMagaluConfig } from "./magaluConfig";

const { apiBaseUrl, environment, channelId } = getMagaluConfig();
```

| Ambiente | apiBaseUrl | channelId |
| --- | --- | --- |
| sandbox | `https://api-sandbox.magalu.com` | `5f62650a-0039-4d65-9b96-266d498c03bd` |
| production | `https://api.magalu.com` | `9fe0d853-732b-4e4a-a0b0-cff988ed043d` |

IDs confirmados no [Sandbox oficial](https://developers.magalu.com/docs/apis/sandbox/overview/index.html)
e na [lista oficial de canais de produção](https://developers.magalu.com/docs/development-guide/sales-channel-id/index.html).
Usar o canal apenas nos campos exigidos por cada endpoint, não como header genérico.

`MAGALU_ENV` é a fonte de verdade e aceita somente `sandbox` ou `production`.
Sem essa variável, o padrão é sandbox, independentemente de `NODE_ENV`.
`MAGALU_API_URL` é opcional por compatibilidade com a configuração já existente;
se presente, deve corresponder ao ambiente. Host divergente, HTTP, caminhos,
queries, fragments e credenciais na URL produzem erro seguro antes de futuras
chamadas. Uma barra final é aceita. Não é possível definir um host arbitrário.
Nenhum secret é retornado pelo helper e a configuração não exige credenciais.

## 2. Preparar o acesso externo

Conferir no IDM se o client inclui a audience `https://api-sandbox.magalu.com`.
Se precisar alterá-la, preservar todas as audiences ainda utilizadas:

```powershell
.\idm.exe client list
.\idm.exe client update --uuid "UUID_DO_CLIENT" --audience "https://api.magalu.com https://api-sandbox.magalu.com"
```

Se o client já usa outras audiences, incluí-las também no comando. UUID não é
Client ID. Nenhum comando IDM foi executado nesta tarefa.
[Configuração oficial do client](https://developers.magalu.com/docs/first-steps/create-an-application/create-application/index.html).

Para executar os exemplos, obter um access token pelo fluxo oficial do ID Magalu
para o tenant de teste. Client ID e secret sozinhos não são bearer tokens. O
callback deste projeto conclui OAuth e guarda tokens criptografados no backend;
não os disponibiliza ao navegador. Os exemplos manuais abaixo ainda dependem
de ferramenta externa autorizada com seu próprio token de homologação.
[Autorização oficial](https://developers.magalu.com/docs/first-steps/create-an-application/authentication-authorization/index.html).

## 3. Onboarding e seller fictício

O tenant de testes pode ser uma conta pessoal. Com um token válido, executar em
Postman ou ferramenta equivalente:

```http
PUT https://api-sandbox.magalu.com/v1/samples/onboarding
Authorization: Bearer TOKEN_DE_TESTE
Content-Type: application/json

{
  "channel_id": "5f62650a-0039-4d65-9b96-266d498c03bd"
}
```

Guardar `seller_id`, `seller_alias`, `channel_id` e `channel_alias` da resposta
real. O seller fictício é associado ao tenant pelo onboarding; não copiar IDs de
exemplos. O guia atual usa Bearer e JSON, sem exigir `x-tenant-id` no exemplo.
[Onboarding oficial](https://developers.magalu.com/docs/apis/sandbox/overview/index.html).

## 4. Criar pedidos de teste pela API

Pré-requisito: SKU já cadastrado no canal de sandbox. Substituir
`SKU_JA_CADASTRADO_NO_SANDBOX` pelo SKU existente, não por um ID inventado.

```http
POST https://api-sandbox.magalu.com/v1/samples/orders
Authorization: Bearer TOKEN_DE_TESTE
Content-Type: application/json

{
  "channel": { "id": "5f62650a-0039-4d65-9b96-266d498c03bd" },
  "deliveries": [
    {
      "items": [
        {
          "info": { "sku": "SKU_JA_CADASTRADO_NO_SANDBOX" },
          "quantity": 1
        }
      ]
    }
  ],
  "payments": [ { "method": "pix" } ]
}
```

Para esse sample, o token precisa de:

- `open:order-order-seller:read`
- `open:order-delivery-seller:read`
- `open:order-logistics-seller:read`

O último é adicional aos três scopes de consulta inicialmente escolhidos.
Não acrescentar permissões de escrita para gerar esse sample. Pagamentos
aceitos: `pix`, `credit_card`, `bank_slip`. Usar a resposta real para os testes;
nenhum pedido foi criado por esta tarefa. Não seguir exemplos antigos que
apontam samples para o host de produção.
[Criar Pedido oficial](https://developers.magalu.com/docs/apis/sandbox/orders/createorder/index.html).

Se faltar o scope adicional, solicitar somente a permissão de leitura para
este teste e obter consentimento/token atualizado:

```powershell
.\idm.exe client add-scope --client-uuid "UUID_DO_CLIENT" --scopes "open:order-logistics-seller:read" --reason "Criar pedidos fictícios via samples oficiais no sandbox."
```

Se não houver SKU, preparar o catálogo em ferramenta/client de homologação,
seguindo o [guia oficial de produtos sandbox](https://developers.magalu.com/docs/apis/sandbox/products/).
Esse preparo pode exigir permissões próprias de catálogo, inclusive escrita;
não ampliar automaticamente o client de leitura do sistema nem cadastrar
produtos na aplicação desta etapa. Os produtos sandbox usam as APIs de catálogo
com o canal de teste; o guia não documenta um gerador de SKU via samples.

Erros 401 podem indicar token ausente/inválido; 400 indica parâmetros incorretos;
422 pode indicar canal desconhecido. A disponibilidade varia por módulo; o
sandbox é sujeito à limpeza periódica. Se faltarem recursos, confirmar com o
suporte Magalu, sem substituir respostas por clientes ou pedidos mockados no app.
[Guia geral](https://developers.magalu.com/docs/apis/sandbox/overview/index.html),
[Sandbox Pedidos](https://developers.magalu.com/docs/apis/sandbox/orders/).

## 5. Voltar para produção

```env
MAGALU_ENV=production
MAGALU_API_URL=https://api.magalu.com
MAGALU_AUTH_URL=https://id.magalu.com
```

`MAGALU_API_URL` também pode ser removida; o helper deriva o host correto.
Confirmar a audience de produção, autorização da loja real e credenciais
adequadas antes das futuras consultas. Não reutilizar seller fictício nem
pedidos sample como registros da cliente. O helper troca apenas host/canal,
não migra contas, tokens ou dados. Como a importação já grava no banco, utilizar
uma base de homologação separada para sandbox. O schema não guarda o ambiente da
conta; um mesmo tenant/código de pedido pode colidir com registros de produção,
e um token com ambas as audiences não garante isolamento. Não alternar ambientes
na mesma base com registros reais. A [revisão completa](./REVIEW.md) registra
os testes realizados e os pré-requisitos ainda pendentes.

## Validação e limites desta entrega

Testes locais verificam seleção de ambiente, IDs oficiais, consistência da URL,
bloqueio de destinos indevidos e ausência de secrets no retorno. Sem acesso ao
Neon, Render ou APIs Magalu; sem alterações no Mercado Livre, frontend ou Prisma.
Não há rotas de samples ou busca de pedidos expostas no backend.
