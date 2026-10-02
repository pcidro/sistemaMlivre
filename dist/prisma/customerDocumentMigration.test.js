"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_test_1 = require("node:test");
const pglite_1 = require("@electric-sql/pglite");
(0, node_test_1.test)("migration mantém clientes existentes, campos opcionais e documentos não únicos", async () => {
    const db = new pglite_1.PGlite();
    try {
        const directory = (0, node_path_1.join)(__dirname, "migrations");
        const current = "20261001180000_add_customer_document";
        const previous = (0, node_fs_1.readdirSync)(directory, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && entry.name < current)
            .sort((a, b) => a.name.localeCompare(b.name));
        for (const migration of previous) {
            await db.exec((0, node_fs_1.readFileSync)((0, node_path_1.join)(directory, migration.name, "migration.sql"), "utf8"));
        }
        await db.exec("INSERT INTO customers (id, name, updated_at) VALUES ('existing', 'Cliente fictício', NOW())");
        await db.exec((0, node_fs_1.readFileSync)((0, node_path_1.join)(directory, current, "migration.sql"), "utf8"));
        strict_1.default.deepEqual((await db.query("SELECT document, document_type FROM customers WHERE id = 'existing'")).rows, [{ document: null, document_type: null }]);
        await db.query("UPDATE customers SET document = $1, document_type = 'CPF' WHERE id = 'existing'", ["00123456789"]);
        await db.query("INSERT INTO customers (id, document, document_type, updated_at) VALUES ('same-document', $1, 'CPF', NOW())", ["00123456789"]);
        await db.query("INSERT INTO customers (id, document, document_type, updated_at) VALUES ('company', $1, 'CNPJ', NOW())", ["12345678000190"]);
        strict_1.default.equal((await db.query("SELECT COUNT(*)::int AS total FROM customers")).rows[0]?.total, 3);
        strict_1.default.equal((await db.query("SELECT document FROM customers WHERE id = 'existing'")).rows[0]?.document, "00123456789");
        const indexes = await db.query("SELECT indexname FROM pg_indexes WHERE tablename = 'customers'");
        strict_1.default.ok(indexes.rows.some((row) => row.indexname === "customers_document_idx"));
        await strict_1.default.rejects(db.exec("UPDATE customers SET document_type = 'RG' WHERE id = 'existing'"));
    }
    finally {
        await db.close();
    }
});
//# sourceMappingURL=customerDocumentMigration.test.js.map