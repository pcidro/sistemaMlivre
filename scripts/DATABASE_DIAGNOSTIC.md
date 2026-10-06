# Diagnóstico de colunas no Render

O servidor registra `database_schema_diagnostic` uma vez por inicialização. O diagnóstico usa a mesma `DATABASE_URL` do processo, consulta somente metadados das tabelas `public.imports` e `public.marketplace_accounts` e o histórico da migration `20261006120000_add_mercadolivre_sync`. Não lê registros de clientes, tokens ou contas e não aplica migrations. Falhas são contidas e não impedem o servidor de iniciar.

Para publicar, envie os arquivos atualizados para o repositório ligado ao backend no Render e execute **Deploy latest commit**. Mantenha o Build Command atual:

```sh
npm install && npx prisma migrate deploy --config prisma7.config.ts && npm run build
```

O Start Command pode continuar `npm run start`. Não é necessário Shell nem trocar credenciais para executar este diagnóstico. Ele também funciona com `npm run start:diagnose:mercadolivre`.

Copie apenas a linha `database_schema_diagnostic` dos logs do novo deploy:

- `status: ready`: todas as colunas verificadas existem; não valida índices, tipos ou o restante do banco. Se P2022 persistir no mesmo processo, investigar a coluna específica ou outra tabela, em vez de reaplicar a migration por suposição.
- `status: schema_missing`: `missingColumns` identifica os nomes esperados que estão ausentes.
- `migrationApplied: false`: o histórico não confirma a migration nesse schema. Conferir o trecho do **build** com a execução do Prisma e a presença do arquivo de migration no commit publicado.
- `migrationApplied: true` junto de `schema_missing`: há divergência entre o histórico e a estrutura real; `migrate deploy` não reaplica uma migration já marcada como concluída. Preparar um reparo específico para as colunas faltantes após confirmar o destino. Não usar reset ou marcar migrations como aplicadas para esconder a divergência.
- `migrationSchemaMatchesRuntime: false`: a URL indica outro schema, enquanto o adapter PrismaPg atual usa `public`. Alinhar configuração de migration e aplicação após confirmar qual schema contém os dados.
- `status: check_failed`: diagnóstico inconclusivo; pode haver falha de conexão ou permissão. Não significa que as colunas estejam faltando.

`databaseTarget` é um identificador derivado do host, porta e nome do banco, sem usuário ou senha. Serve para comparar destinos sem publicar a conexão. Conexões Neon pooler e direta para o mesmo destino têm o mesmo identificador. Não inclui credenciais nem permite verificar se as senhas coincidem.

Localmente, `npm run diagnose:database` executa a mesma consulta. O diagnóstico não resolve o erro OAuth `invalid_client`, que acontece na API do Mercado Livre antes da importação.
