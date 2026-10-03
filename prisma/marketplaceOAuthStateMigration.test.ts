import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("migration de state preserva contas existentes e permite consumo único e expiração", async () => {
  const db = new PGlite();
  try {
    const directory = join(__dirname, "migrations");
    const current = "20261002120000_add_marketplace_oauth_states";
    for (const migration of readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name < current)
      .sort((a, b) => a.name.localeCompare(b.name))) {
      await db.exec(readFileSync(join(directory, migration.name, "migration.sql"), "utf8"));
    }
    await db.exec("INSERT INTO users (id, name, username, email, password_hash, updated_at) VALUES ('user', 'Fictício', 'teste', 'teste@example.com', 'hash', NOW())");
    await db.exec("INSERT INTO marketplace_accounts (id, platform, name, external_account_id, access_token_encrypted, user_id, updated_at) VALUES ('ml', 'MERCADO_LIVRE', 'ML existente', '123', 'v1.ficticio', 'user', NOW())");
    const before = (await db.query("SELECT * FROM marketplace_accounts")).rows;
    await db.exec(readFileSync(join(directory, current, "migration.sql"), "utf8"));
    assert.deepEqual((await db.query("SELECT * FROM marketplace_accounts")).rows, before);
    await db.exec("INSERT INTO marketplace_oauth_states (state_hash, platform, user_id, config_fingerprint, expires_at) VALUES ('valid', 'MAGALU', 'user', 'config', NOW() + INTERVAL '10 minutes'), ('expired', 'MAGALU', 'user', 'config', NOW() - INTERVAL '1 minute')");
    const consume = "DELETE FROM marketplace_oauth_states WHERE state_hash = $1 AND platform = 'MAGALU' AND config_fingerprint = $2 AND expires_at > NOW() RETURNING user_id";
    assert.equal((await db.query(consume, ["valid", "other-config"])).rows.length, 0);
    assert.equal((await db.query(consume, ["expired", "config"])).rows.length, 0);
    const consumed = await Promise.all([db.query(consume, ["valid", "config"]), db.query(consume, ["valid", "config"])]);
    assert.equal(consumed.reduce((total, result) => total + result.rows.length, 0), 1);
    await assert.rejects(db.exec("INSERT INTO marketplace_oauth_states (state_hash, platform, user_id, config_fingerprint, expires_at) VALUES ('orphan', 'MAGALU', 'missing-user', 'config', NOW())"));
  } finally { await db.close(); }
});
