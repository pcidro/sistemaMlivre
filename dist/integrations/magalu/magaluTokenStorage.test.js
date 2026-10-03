"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const magaluHttpError_1 = require("./magaluHttpError");
const magaluTokenStorage_1 = require("./magaluTokenStorage");
(0, node_test_1.test)("persistência bloqueia a conta e atualiza access/refresh/expiração juntos em uma transação", async () => {
    const account = {
        id: "id-ficticio", platform: "MAGALU", userId: "usuario-ficticio", externalAccountId: "tenant-ficticio", isActive: true,
        accessTokenEncrypted: "access-antigo-criptografado", refreshTokenEncrypted: "refresh-antigo-criptografado", tokenExpiresAt: new Date(0),
    };
    const saved = { accessTokenEncrypted: "access-novo-criptografado", refreshTokenEncrypted: "refresh-novo-criptografado", tokenExpiresAt: new Date(7200_000) };
    const steps = [];
    const db = {
        marketplaceAccount: {
            findUnique: async () => account,
            updateMany: async (args) => {
                steps.push("save");
                strict_1.default.deepEqual(args.where, { id: account.id, platform: "MAGALU", isActive: true, userId: account.userId,
                    accessTokenEncrypted: account.accessTokenEncrypted, refreshTokenEncrypted: account.refreshTokenEncrypted });
                strict_1.default.deepEqual(args.data, saved);
                return { count: 1 };
            },
        },
        async $transaction(work, options) {
            strict_1.default.equal(options.timeout, 25_000);
            strict_1.default.equal(options.maxWait, 10_000);
            steps.push("begin");
            const result = await work({
                marketplaceAccount: {
                    ...db.marketplaceAccount,
                    findUnique: async () => { steps.push("read"); return account; },
                },
                async $queryRaw(query, ...values) {
                    steps.push("lock");
                    strict_1.default.equal(query.join("?"), "SELECT id FROM marketplace_accounts WHERE id = ? FOR UPDATE");
                    strict_1.default.deepEqual(values, [account.id]);
                    return [];
                },
            });
            steps.push("commit");
            return result;
        },
    };
    const storage = (0, magaluTokenStorage_1.createMagaluTokenStorage)(db);
    const result = await storage.withLockedAccount(account.id, async (current, save) => {
        strict_1.default.equal(current, account);
        steps.push("refresh");
        await save(saved);
        return "result-after-commit";
    });
    steps.push(result);
    strict_1.default.deepEqual(steps, ["begin", "lock", "read", "refresh", "save", "commit", "result-after-commit"]);
});
(0, node_test_1.test)("atualização sem conta correspondente falha sem retornar credenciais novas", async () => {
    const account = {
        id: "id-ficticio", platform: "MAGALU", userId: "usuario-ficticio", externalAccountId: "tenant-ficticio", isActive: true,
        accessTokenEncrypted: "access-antigo", refreshTokenEncrypted: "refresh-antigo", tokenExpiresAt: new Date(0),
    };
    const db = {
        marketplaceAccount: { findUnique: async () => account, updateMany: async () => ({ count: 0 }) },
        $transaction: async (work) => work({ marketplaceAccount: db.marketplaceAccount, $queryRaw: async () => [] }),
    };
    const storage = (0, magaluTokenStorage_1.createMagaluTokenStorage)(db);
    await strict_1.default.rejects(storage.withLockedAccount(account.id, async (_account, save) => {
        await save({ accessTokenEncrypted: "novo", refreshTokenEncrypted: "novo", tokenExpiresAt: new Date() });
    }), (error) => error instanceof magaluHttpError_1.MagaluHttpError && error.code === "account_changed");
});
//# sourceMappingURL=magaluTokenStorage.test.js.map