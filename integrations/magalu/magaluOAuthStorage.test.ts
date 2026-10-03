import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../../errors/AppError";
import { createMagaluOAuthStorage, type MagaluOAuthDatabase, type MagaluAccountAuthorization } from "./magaluOAuthStorage";
import { testUserId, otherUserId, tenantId } from "./magaluOAuthTestSupport";

const authorization: MagaluAccountAuthorization = {
  userId: testUserId,
  externalAccountId: tenantId,
  accessTokenEncrypted: "v1.access-criptografado-ficticio",
  refreshTokenEncrypted: "v1.refresh-criptografado-ficticio",
  tokenExpiresAt: new Date(Date.now() + 7200_000),
};

function setup() {
  const database: MagaluOAuthDatabase = {
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
  return { database, storage: createMagaluOAuthStorage(database) };
}

test("storage cadastra plataforma MAGALU com sub integral, sem inventar nome ou CNPJ", async (t) => {
  const { database, storage } = setup();
  const find = t.mock.method(database.marketplaceAccount, "findUnique", async () => null);
  const create = t.mock.method(database.marketplaceAccount, "create", async () => ({ id: "account" }));
  await storage.saveAccount(authorization);
  assert.equal(find.mock.calls.length, 1);
  assert.equal(create.mock.calls.length, 1);
  assert.deepEqual(create.mock.calls[0]?.arguments[0], {
    data: { ...authorization, platform: "MAGALU", name: tenantId }, select: { id: true },
  });
});

test("storage reconecta apenas o dono e preserva nome/CNPJ existentes", async (t) => {
  const { database, storage } = setup();
  t.mock.method(database.marketplaceAccount, "findUnique", async () => ({ id: "account", userId: testUserId }));
  const update = t.mock.method(database.marketplaceAccount, "updateMany", async () => ({ count: 1 }));
  await storage.saveAccount(authorization);
  const { userId, externalAccountId: _externalAccountId, ...tokens } = authorization;
  assert.deepEqual(update.mock.calls[0]?.arguments[0], {
    where: { id: "account", userId, platform: "MAGALU" }, data: { ...tokens, isActive: true },
  });
});

test("storage impede transferência de conta, inclusive sem dono conhecido", async (t) => {
  const { database, storage } = setup();
  const create = t.mock.method(database.marketplaceAccount, "create", async () => { throw new Error("não deve criar"); });
  const update = t.mock.method(database.marketplaceAccount, "updateMany", async () => { throw new Error("não deve atualizar"); });
  const find = t.mock.method(database.marketplaceAccount, "findUnique", async () => ({ id: "account", userId: otherUserId as string | null }));
  await assert.rejects(storage.saveAccount(authorization), (error: unknown) => error instanceof AppError && error.statusCode === 409);
  find.mock.mockImplementation(async () => ({ id: "account", userId: null }));
  await assert.rejects(storage.saveAccount(authorization), (error: unknown) => error instanceof AppError && error.statusCode === 409);
  assert.equal(create.mock.calls.length, 0);
  assert.equal(update.mock.calls.length, 0);
});

test("criação concorrente por outro usuário não permite sobrescrever a conta", async (t) => {
  const { database, storage } = setup();
  let reads = 0;
  const find = t.mock.method(database.marketplaceAccount, "findUnique", async () => {
    reads++;
    return reads === 1 ? null : { id: "account", userId: otherUserId };
  });
  const create = t.mock.method(database.marketplaceAccount, "create", async () => { throw { code: "P2002" }; });
  const update = t.mock.method(database.marketplaceAccount, "updateMany", async () => { throw new Error("não deve atualizar"); });
  await assert.rejects(storage.saveAccount(authorization), (error: unknown) => error instanceof AppError && error.statusCode === 409);
  assert.equal(find.mock.calls.length, 2);
  assert.equal(create.mock.calls.length, 1);
  assert.equal(update.mock.calls.length, 0);
});

test("state persistido só é consumido uma vez com DELETE condicional", async (t) => {
  const { database, storage } = setup();
  const now = new Date();
  const state = { stateHash: "hash", platform: "MAGALU", userId: testUserId,
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
  assert.equal(results.filter(Boolean).length, 1);
  assert.deepEqual(results.find(Boolean), { userId: testUserId });
  assert.deepEqual(remove.mock.calls[0]?.arguments[0], {
    where: { stateHash: "hash", platform: "MAGALU", configFingerprint: "fingerprint", expiresAt: { gt: now } },
  });
});

test("state de outra plataforma, configuração ou vencido não é consumido", async (t) => {
  const { database, storage } = setup();
  const now = new Date();
  const base = { stateHash: "hash", platform: "MAGALU", userId: testUserId,
    configFingerprint: "fingerprint", expiresAt: new Date(now.getTime() + 60_000) };
  const find = t.mock.method(database.marketplaceOAuthState, "findUnique", async () => base);
  const remove = t.mock.method(database.marketplaceOAuthState, "deleteMany", async () => { throw new Error("não deve apagar"); });
  assert.equal(await storage.consumeState("hash", "wrong", now), null);
  find.mock.mockImplementation(async () => ({ ...base, platform: "MERCADO_LIVRE" }));
  assert.equal(await storage.consumeState("hash", "fingerprint", now), null);
  find.mock.mockImplementation(async () => ({ ...base, expiresAt: now }));
  assert.equal(await storage.consumeState("hash", "fingerprint", now), null);
  assert.equal(remove.mock.calls.length, 0);
});
