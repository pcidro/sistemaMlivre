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
(0, node_test_1.test)("migration de state preserva contas existentes e permite consumo único e expiração", async () => {
    const db = new pglite_1.PGlite();
    try {
        const directory = (0, node_path_1.join)(__dirname, "migrations");
        const current = "20261002120000_add_marketplace_oauth_states";
        for (const migration of (0, node_fs_1.readdirSync)(directory, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && entry.name < current)
            .sort((a, b) => a.name.localeCompare(b.name))) {
            await db.exec((0, node_fs_1.readFileSync)((0, node_path_1.join)(directory, migration.name, "migration.sql"), "utf8"));
        }
        await db.exec("INSERT INTO users (id, name, username, email, password_hash, updated_at) VALUES ('user', 'Fictício', 'teste', 'teste@example.com', 'hash', NOW())");
        await db.exec("INSERT INTO marketplace_accounts (id, platform, name, external_account_id, access_token_encrypted, user_id, updated_at) VALUES ('ml', 'MERCADO_LIVRE', 'ML existente', '123', 'v1.ficticio', 'user', NOW())");
        const before = (await db.query("SELECT * FROM marketplace_accounts")).rows;
        await db.exec((0, node_fs_1.readFileSync)((0, node_path_1.join)(directory, current, "migration.sql"), "utf8"));
        strict_1.default.deepEqual((await db.query("SELECT * FROM marketplace_accounts")).rows, before);
        await db.exec("INSERT INTO marketplace_oauth_states (state_hash, platform, user_id, config_fingerprint, expires_at) VALUES ('valid', 'MAGALU', 'user', 'config', NOW() + INTERVAL '10 minutes'), ('expired', 'MAGALU', 'user', 'config', NOW() - INTERVAL '1 minute')");
        const consume = "DELETE FROM marketplace_oauth_states WHERE state_hash = $1 AND platform = 'MAGALU' AND config_fingerprint = $2 AND expires_at > NOW() RETURNING user_id";
        strict_1.default.equal((await db.query(consume, ["valid", "other-config"])).rows.length, 0);
        strict_1.default.equal((await db.query(consume, ["expired", "config"])).rows.length, 0);
        const consumed = await Promise.all([db.query(consume, ["valid", "config"]), db.query(consume, ["valid", "config"])]);
        strict_1.default.equal(consumed.reduce((total, result) => total + result.rows.length, 0), 1);
        await strict_1.default.rejects(db.exec("INSERT INTO marketplace_oauth_states (state_hash, platform, user_id, config_fingerprint, expires_at) VALUES ('orphan', 'MAGALU', 'missing-user', 'config', NOW())"));
    }
    finally {
        await db.close();
    }
});
//# sourceMappingURL=marketplaceOAuthStateMigration.test.js.map