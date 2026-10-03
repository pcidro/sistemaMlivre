"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const AppError_1 = require("../../errors/AppError");
const magaluOAuthStorage_1 = require("./magaluOAuthStorage");
const magaluOAuthTestSupport_1 = require("./magaluOAuthTestSupport");
const authorization = {
    userId: magaluOAuthTestSupport_1.testUserId,
    externalAccountId: magaluOAuthTestSupport_1.tenantId,
    accessTokenEncrypted: "v1.access-criptografado-ficticio",
    refreshTokenEncrypted: "v1.refresh-criptografado-ficticio",
    tokenExpiresAt: new Date(Date.now() + 7200_000),
};
function setup() {
    const database = {
        user: { findUnique: async () => { throw new Error("unexpected query"); } },
        marketplaceOAuthState: {
            create: async () => { throw new Error("unexpected query"); },
            findUnique: async () => { throw new Error("unexpected query"); },
            deleteMany: async () => { throw new Error("unexpected query"); },
        },
        marketplaceAccount: {
            findUnique: async () => { throw new Error("unexpected query"); },
            create: async () => { throw new Error("unexpected query"); },
            updateMany: async () => { throw new Error("unexpected query"); },
        },
    };
    return { database, storage: (0, magaluOAuthStorage_1.createMagaluOAuthStorage)(database) };
}
(0, node_test_1.test)("storage cadastra plataforma MAGALU com sub integral, sem inventar nome ou CNPJ", async (t) => {
    const { database, storage } = setup();
    const find = t.mock.method(database.marketplaceAccount, "findUnique", async () => null);
    const create = t.mock.method(database.marketplaceAccount, "create", async () => ({ id: "account" }));
    await storage.saveAccount(authorization);
    strict_1.default.equal(find.mock.calls.length, 1);
    strict_1.default.equal(create.mock.calls.length, 1);
    strict_1.default.deepEqual(create.mock.calls[0]?.arguments[0], {
        data: { ...authorization, platform: "MAGALU", name: magaluOAuthTestSupport_1.tenantId }, select: { id: true },
    });
});
(0, node_test_1.test)("storage reconecta apenas o dono e preserva nome/CNPJ existentes", async (t) => {
    const { database, storage } = setup();
    t.mock.method(database.marketplaceAccount, "findUnique", async () => ({ id: "account", userId: magaluOAuthTestSupport_1.testUserId }));
    const update = t.mock.method(database.marketplaceAccount, "updateMany", async () => ({ count: 1 }));
    await storage.saveAccount(authorization);
    const { userId, externalAccountId: _externalAccountId, ...tokens } = authorization;
    strict_1.default.deepEqual(update.mock.calls[0]?.arguments[0], {
        where: { id: "account", userId, platform: "MAGALU" }, data: { ...tokens, isActive: true },
    });
});
(0, node_test_1.test)("storage impede transferência de conta, inclusive sem dono conhecido", async (t) => {
    const { database, storage } = setup();
    const create = t.mock.method(database.marketplaceAccount, "create", async () => { throw new Error("não deve criar"); });
    const update = t.mock.method(database.marketplaceAccount, "updateMany", async () => { throw new Error("não deve atualizar"); });
    const find = t.mock.method(database.marketplaceAccount, "findUnique", async () => ({ id: "account", userId: magaluOAuthTestSupport_1.otherUserId }));
    await strict_1.default.rejects(storage.saveAccount(authorization), (error) => error instanceof AppError_1.AppError && error.statusCode === 409);
    find.mock.mockImplementation(async () => ({ id: "account", userId: null }));
    await strict_1.default.rejects(storage.saveAccount(authorization), (error) => error instanceof AppError_1.AppError && error.statusCode === 409);
    strict_1.default.equal(create.mock.calls.length, 0);
    strict_1.default.equal(update.mock.calls.length, 0);
});
(0, node_test_1.test)("criação concorrente por outro usuário não permite sobrescrever a conta", async (t) => {
    const { database, storage } = setup();
    let reads = 0;
    const find = t.mock.method(database.marketplaceAccount, "findUnique", async () => {
        reads++;
        return reads === 1 ? null : { id: "account", userId: magaluOAuthTestSupport_1.otherUserId };
    });
    const create = t.mock.method(database.marketplaceAccount, "create", async () => { throw { code: "P2002" }; });
    const update = t.mock.method(database.marketplaceAccount, "updateMany", async () => { throw new Error("não deve atualizar"); });
    await strict_1.default.rejects(storage.saveAccount(authorization), (error) => error instanceof AppError_1.AppError && error.statusCode === 409);
    strict_1.default.equal(find.mock.calls.length, 2);
    strict_1.default.equal(create.mock.calls.length, 1);
    strict_1.default.equal(update.mock.calls.length, 0);
});
(0, node_test_1.test)("state persistido só é consumido uma vez com DELETE condicional", async (t) => {
    const { database, storage } = setup();
    const now = new Date();
    const state = { stateHash: "hash", platform: "MAGALU", userId: magaluOAuthTestSupport_1.testUserId,
        configFingerprint: "fingerprint", expiresAt: new Date(now.getTime() + 60_000) };
    t.mock.method(database.marketplaceOAuthState, "findUnique", async () => state);
    let remaining = true;
    const remove = t.mock.method(database.marketplaceOAuthState, "deleteMany", async () => {
        const count = remaining ? 1 : 0;
        remaining = false;
        return { count };
    });
    const results = await Promise.all([
        storage.consumeState("hash", "fingerprint", now),
        storage.consumeState("hash", "fingerprint", now),
    ]);
    strict_1.default.equal(results.filter(Boolean).length, 1);
    strict_1.default.deepEqual(results.find(Boolean), { userId: magaluOAuthTestSupport_1.testUserId });
    strict_1.default.deepEqual(remove.mock.calls[0]?.arguments[0], {
        where: { stateHash: "hash", platform: "MAGALU", configFingerprint: "fingerprint", expiresAt: { gt: now } },
    });
});
(0, node_test_1.test)("state de outra plataforma, configuração ou vencido não é consumido", async (t) => {
    const { database, storage } = setup();
    const now = new Date();
    const base = { stateHash: "hash", platform: "MAGALU", userId: magaluOAuthTestSupport_1.testUserId,
        configFingerprint: "fingerprint", expiresAt: new Date(now.getTime() + 60_000) };
    const find = t.mock.method(database.marketplaceOAuthState, "findUnique", async () => base);
    const remove = t.mock.method(database.marketplaceOAuthState, "deleteMany", async () => { throw new Error("não deve apagar"); });
    strict_1.default.equal(await storage.consumeState("hash", "wrong", now), null);
    find.mock.mockImplementation(async () => ({ ...base, platform: "MERCADO_LIVRE" }));
    strict_1.default.equal(await storage.consumeState("hash", "fingerprint", now), null);
    find.mock.mockImplementation(async () => ({ ...base, expiresAt: now }));
    strict_1.default.equal(await storage.consumeState("hash", "fingerprint", now), null);
    strict_1.default.equal(remove.mock.calls.length, 0);
});
//# sourceMappingURL=magaluOAuthStorage.test.js.map