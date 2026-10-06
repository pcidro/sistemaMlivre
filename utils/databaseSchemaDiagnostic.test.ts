import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { diagnoseDatabaseSchema, syncMigration, type SchemaDiagnosticClient } from "./databaseSchemaDiagnostic";

test("diagnóstico identifica as cinco colunas ausentes e confirma a migration sem modificar registros", async () => {
  const db = new PGlite();
  const client: SchemaDiagnosticClient = {
    connect: async () => {},
    query: (sql, values) => db.query<Record<string, unknown>>(sql, values),
    end: async () => {},
  };
  try {
    const directory = join(__dirname, "../prisma/migrations");
    for (const name of readdirSync(directory).filter(name => name < syncMigration && name !== "migration_lock.toml").sort()) {
      await db.exec(readFileSync(join(directory, name, "migration.sql"), "utf8"));
    }
    const url = "postgresql://user:fake-password@ep-fake-pooler.example.test/app?sslmode=require";
    const before = await diagnoseDatabaseSchema(url, () => client);
    assert.equal(before.status, "schema_missing");
    assert.deepEqual(before.missingColumns, ["imports.date_from", "imports.date_to", "imports.automatic", "imports.updated_at", "marketplace_accounts.last_sync_at"]);
    assert.equal(before.migrationApplied, false);
    await db.exec(readFileSync(join(directory, syncMigration, "migration.sql"), "utf8"));
    await db.exec("CREATE TABLE _prisma_migrations (migration_name TEXT, finished_at TIMESTAMP, rolled_back_at TIMESTAMP, started_at TIMESTAMP); INSERT INTO _prisma_migrations VALUES ('20261006120000_add_mercadolivre_sync', NOW(), NULL, NOW());");
    const after = await diagnoseDatabaseSchema(url, () => client);
    assert.equal(after.status, "ready");
    assert.deepEqual(after.missingColumns, []);
    assert.equal(after.migrationApplied, true);
    await db.exec('ALTER TABLE imports DROP COLUMN automatic');
    const drift = await diagnoseDatabaseSchema(url, () => client);
    assert.equal(drift.migrationApplied, true);
    assert.equal(drift.status, "schema_missing");
    assert.deepEqual(drift.missingColumns, ["imports.automatic"]);
    assert.equal((await db.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM imports")).rows[0]?.count, 0);
  } finally { await db.close(); }
});

test("falha no banco é contida e não registra credenciais nem mensagem do driver", async () => {
  let ended = false;
  const fail: SchemaDiagnosticClient = {
    connect: async () => { throw new Error("fake-password in connection details"); },
    query: async () => { throw new Error("must not query after failed connection"); },
    end: async () => { ended = true; },
  };
  const result = await diagnoseDatabaseSchema("postgresql://user:fake-password@ep-fake.example.test/app", () => fail);
  assert.equal(result.status, "check_failed");
  assert.equal(ended, true);
  assert.equal(JSON.stringify(result).includes("fake-password"), false);
  assert.equal(JSON.stringify(result).includes("ep-fake"), false);
});

test("destino compara conexão pooler e direta, ignora senha e detecta divergência de schema", async () => {
  const fail: SchemaDiagnosticClient = { connect: async () => { throw new Error(); }, query: async () => ({ rows: [] }), end: async () => {} };
  const inspect = (url: string) => diagnoseDatabaseSchema(url, () => fail);
  const direct = await inspect("postgresql://u:a@ep-test.example.test/app");
  const pooled = await inspect("postgresql://u:b@ep-test-pooler.example.test/app?sslmode=require");
  const otherDb = await inspect("postgresql://u:a@ep-test.example.test/other");
  assert.equal(direct.databaseTarget, pooled.databaseTarget);
  assert.notEqual(direct.databaseTarget, otherDb.databaseTarget);
  assert.equal(direct.migrationSchemaMatchesRuntime, true);
  assert.equal((await inspect("postgresql://u:a@ep-test.example.test/app?schema=other")).migrationSchemaMatchesRuntime, false);
  assert.equal((await diagnoseDatabaseSchema(undefined, () => fail)).status, "check_failed");
  assert.equal((await diagnoseDatabaseSchema("invalid url", () => fail)).databaseTarget, null);
});
