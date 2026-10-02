# Consulta dos clientes importados

Rotas autenticadas, seguindo o prefixo existente do backend:

- `GET /api/customers`
- `GET /api/customers/:id`

Aceitam o cookie `auth_token` ou Bearer token da autenticação existente. O usuário vem exclusivamente de `req.user_id`. Clientes sem pedidos associados a uma conta desse usuário não aparecem. Contas desconectadas continuam permitindo consultar seu histórico, desde que ainda pertençam ao usuário. Não há consultas aos marketplaces nem alterações no banco nestas APIs.

## Lista

Cada cliente aparece uma única vez. A plataforma, conta e pedido apresentados são os do **pedido mais recente que satisfaz todos os filtros** e pertence ao usuário. Assim, um cliente reutilizado em diferentes marketplaces não duplica a paginação e a origem mostrada corresponde à pesquisa. Uma busca pelo identificador de uma venda antiga apresenta essa venda; uma busca pelo nome apresenta o pedido mais recente autorizado.

| Parâmetro | Regra |
| --- | --- |
| `page` | Inteiro positivo; padrão 1. |
| `limit` | Inteiro entre 1 e 100; padrão 50. |
| `search` | Até 200 caracteres; procura trecho do nome, telefone, telefone normalizado, CPF/CNPJ ou identificador externo do pedido. CPF/CNPJ pode ser pesquisado com ou sem pontuação, incluindo barra. Nomes/pedidos ignoram diferenças de caixa. Uma busca contendo apenas dígitos e formatação telefônica também procura os dígitos sem formatação. `%`, `_` e `\` são tratados literalmente. |
| `platform` | `MERCADO_LIVRE` ou `MAGALU`. |
| `marketplaceAccountId` | UUID da conta. Contas alheias/inexistentes não produzem resultados. |
| `hasPhone` | `true` ou `false`; presença de telefone normalizado não nulo/vazio. |
| `dateFrom`, `dateTo` | Intervalo inclusivo da data do pedido; cada extremo é opcional. ISO 8601 com fuso, ou `YYYY-MM-DD` para dia completo em UTC. Pedidos sem data não atendem um filtro de período. |

Filtros inválidos, repetidos em forma de lista ou desconhecidos retornam 400. A ordenação da lista é por nome, com nomes ausentes por último, e desempate por ID, para paginação estável.

```json
{
  "data": [
    {
      "customerId": "00000000-0000-4000-8000-000000000001",
      "name": "Maria Fictícia",
      "phone": "5511999990000",
      "normalizedPhone": "5511999990000",
      "document": "12345678900",
      "documentType": "CPF",
      "platform": "MERCADO_LIVRE",
      "marketplaceAccount": {
        "id": "00000000-0000-4000-8000-000000000010",
        "name": "Conta fictícia",
        "cnpj": null
      },
      "externalOrderId": "1001",
      "orderDate": "2026-09-05T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 1, "totalPages": 1 }
}
```

`name`, `phone`, `normalizedPhone`, `document`, `documentType`, `cnpj` e `orderDate` podem ser `null`. `total` conta clientes distintos que atendem aos filtros; sem resultados, `totalPages` é zero. Uma página além da última retorna `data: []`, preservando o total.

## Detalhes

`GET /api/customers/:id` usa o ID interno do cliente, validado como UUID, e retorna diretamente o mesmo objeto básico acima, usando o pedido autorizado mais recente. Não retorna histórico ilimitado, notas, XML, credenciais ou pedidos de outras contas/usuários. Cliente inexistente e cliente sem vínculo autorizado recebem o mesmo 404.

## Consultas e privacidade

`CustomerQueryService` aplica a propriedade da conta no filtro do cliente **e** no filtro dos pedidos selecionados. Filtros de plataforma, conta, data e busca precisam ser atendidos pelo mesmo pedido. A consulta seleciona apenas os campos básicos do cliente, incluindo documento e tipo, o pedido representativo e `id/name/cnpj` da conta. A resposta também é construída por uma lista explícita de campos permitidos.

A lista usa `count` e uma única chamada `findMany` com seleção das relações, sem consultas dentro do mapeamento de clientes. O Prisma carrega as relações em conjunto; o número de consultas não cresce por cliente. Página e total são lidos na mesma transação `RepeatableRead`. Os detalhes usam uma chamada `findFirst` com seleção das relações na mesma transação de leitura. As respostas usam `Cache-Control: private, no-store`; erros de banco não expõem mensagens ou parâmetros da consulta.

Referências oficiais da versão usada: [leituras de relações do Prisma 7](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/relation-queries) e [filtros do Prisma 7](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/filtering-and-sorting). Não é necessário ativar funcionalidades preview. O documento é opcional no schema, com índice não único. Os índices existentes de cliente, conta e pedido são preservados; busca por trecho pode exigir índices adicionais quando o volume justificar uma análise do plano de consulta.

## Validação

Testes do serviço e testes HTTP cobrem autenticação, isolamento entre usuários (inclusive cliente ligado a múltiplas contas), paginação, todos os filtros, busca por telefone formatado/pedido, dados opcionais, detalhes e respostas sem credenciais. As consultas Prisma são verificadas com fixtures fictícias e um executor em memória; não há acesso ao banco configurado em `DATABASE_URL`. Este executor não substitui a validação dos planos SQL ou do isolamento de transações em um PostgreSQL de teste. `npm run build` verifica os contratos de tipos do Prisma.
