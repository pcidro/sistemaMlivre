# Dados do dashboard

`GET /api/dashboard` segue o prefixo existente do backend e exige autenticação por cookie `auth_token` ou Bearer token. O usuário é obtido exclusivamente de `req.user_id`; parâmetros recebidos pela URL não mudam o usuário consultado.

```json
{
  "totalCustomers": 10,
  "customersWithPhone": 7,
  "customersWithoutPhone": 3,
  "mercadoLivreCustomers": 9,
  "lastImport": {
    "startedAt": "2026-10-01T12:00:00.000Z",
    "finishedAt": null,
    "status": "PROCESSING",
    "ordersProcessed": 5
  }
}
```

Os totais contam clientes distintos com pelo menos um pedido em contas pertencentes ao usuário, incluindo o histórico de contas desconectadas. Clientes sem pedido autorizado não entram nos totais. Um cliente ligado a vários pedidos/contas aparece uma única vez. `mercadoLivreCustomers` conta quem tem pelo menos um pedido do Mercado Livre em uma conta desse usuário; uma venda do Mercado Livre em conta alheia não muda esse contador.

Com telefone significa `normalizedPhone` não nulo/vazio, mantendo o critério de `GET /api/customers`. `customersWithoutPhone` é a diferença entre total e clientes com telefone. Sem dados, os totais são zero.

`lastImport` é a importação com `startedAt` mais recente entre todas as contas do usuário, de qualquer plataforma ou status. Empates usam ID decrescente. É `null` se não há importações; `finishedAt` pode ser `null` em uma execução em andamento. Somente os quatro campos do contrato são retornados.

## Consultas

São duas consultas em uma transação `RepeatableRead`: uma consulta SQL parametrizada via Prisma agrega todos os contadores e uma `import.findFirst` busca a última importação com seleção explícita de campos. A agregação agrupa os pedidos autorizados por cliente no banco, sem carregar listas de clientes ou pedidos em memória. Não há queries individuais por cliente, consulta aos marketplaces, alteração de schema ou escrita no banco.

O uso de parâmetro vinculado segue as [boas práticas do Prisma 7](https://docs.prisma.io/docs/orm/v7/more/best-practices). As respostas usam `Cache-Control: private, no-store`; falhas do banco retornam erro sanitizado e não um resumo artificial com zeros.

## Testes

Os testes executam a consulta efetiva de agregação em PostgreSQL embarcado PGlite, em memória, com esquema mínimo compatível e dados fictícios. PGlite já estava presente transitivamente com o Prisma e foi fixado como dependência de desenvolvimento para permitir seu uso explícito nos testes. Não altera a tecnologia do banco da aplicação.

A chamada Prisma da última importação é verificada por um executor de testes que também consulta esse banco embarcado. Os testes HTTP verificam autenticação, usuário da sessão e contrato. Cobrem duplicidade entre pedidos/contas, plataformas, telefones ausentes/vazios, contas alheias/desconectadas, importações em andamento/com erro, ausência de dados e parametrização SQL. Não acessam `DATABASE_URL` nem substituem a validação de planos e isolamento no PostgreSQL/Neon de produção.
