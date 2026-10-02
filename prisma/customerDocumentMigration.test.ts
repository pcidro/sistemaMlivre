import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("migration mantém clientes existentes, campos opcionais e documentos não únicos", async () => {
  const db = new PGlite();
  try {
    const directory = join(__dirname, "migrations");
    const current = "20261001180000_add_customer_document";
    const previous = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name < current)
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const migration of previous) {
      await db.exec(readFileSync(join(directory, migration.name, "migration.sql"), "utf8"));
    }
    await db.exec("INSERT INTO customers (id, name, updated_at) VALUES ('existing', 'Cliente fictício', NOW())");
    await db.exec(readFileSync(join(directory, current, "migration.sql"), "utf8"));
    assert.deepEqual((await db.query("SELECT document, document_type FROM customers WHERE id = 'existing'")).rows,
      [{ document: null, document_type: null }]);
    await db.query("UPDATE customers SET document = $1, document_type = 'CPF' WHERE id = 'existing'", ["00123456789"]);
    await db.query("INSERT INTO customers (id, document, document_type, updated_at) VALUES ('same-document', $1, 'CPF', NOW())", ["00123456789"]);
    await db.query("INSERT INTO customers (id, document, document_type, updated_at) VALUES ('company', $1, 'CNPJ', NOW())", ["12345678000190"]);
    assert.equal((await db.query<{ total: number }>("SELECT COUNT(*)::int AS total FROM customers")).rows[0]?.total, 3);
    assert.equal((await db.query<{ document: string }>("SELECT document FROM customers WHERE id = 'existing'")).rows[0]?.document, "00123456789");
    const indexes = await db.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE tablename = 'customers'");
    assert.ok(indexes.rows.some((row) => row.indexname === "customers_document_idx"));
    await assert.rejects(db.exec("UPDATE customers SET document_type = 'RG' WHERE id = 'existing'"));
  } finally {
    await db.close();
  }
});
