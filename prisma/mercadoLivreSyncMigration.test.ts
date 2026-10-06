import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("migration conserva registros e banco impede dois PROCESSING ML por conta, sem bloquear Magalu", async () => {
  const db = new PGlite();
  try {
    const directory = join(__dirname, "migrations");
    const current = "20261006120000_add_mercadolivre_sync";
    for (const name of readdirSync(directory).filter(name => name < current && name !== "migration_lock.toml").sort()) {
      await db.exec(readFileSync(join(directory, name, "migration.sql"), "utf8"));
    }
    await db.exec(`INSERT INTO marketplace_accounts (id, platform, name, external_account_id, access_token_encrypted, updated_at)
      VALUES ('ml', 'MERCADO_LIVRE', 'Fictícia', '1', 'fake', NOW()), ('magalu', 'MAGALU', 'Fictícia', '2', 'fake', NOW());
      INSERT INTO imports (id, platform, marketplace_account_id, started_at) VALUES
      ('old', 'MERCADO_LIVRE', 'ml', '2026-10-01'), ('new', 'MERCADO_LIVRE', 'ml', '2026-10-02');`);
    await db.exec(readFileSync(join(directory, current, "migration.sql"), "utf8"));
    assert.deepEqual((await db.query("SELECT id, status FROM imports ORDER BY started_at")).rows,
      [{ id: "old", status: "ERROR" }, { id: "new", status: "PROCESSING" }]);
    await assert.rejects(db.exec("INSERT INTO imports (id, platform, marketplace_account_id) VALUES ('duplicate', 'MERCADO_LIVRE', 'ml')"));
    await db.exec("UPDATE imports SET status = 'SUCCESS' WHERE id = 'new'; INSERT INTO imports (id, platform, marketplace_account_id) VALUES ('retry', 'MERCADO_LIVRE', 'ml')");
    await db.exec("INSERT INTO imports (id, platform, marketplace_account_id) VALUES ('mag1', 'MAGALU', 'magalu'), ('mag2', 'MAGALU', 'magalu')");
    assert.deepEqual((await db.query("SELECT last_sync_at FROM marketplace_accounts WHERE id = 'ml'")).rows, [{ last_sync_at: null }]);
    assert.equal((await db.query<{ total: number }>("SELECT COUNT(*)::int AS total FROM imports")).rows[0]?.total, 5);
  } finally { await db.close(); }
});
