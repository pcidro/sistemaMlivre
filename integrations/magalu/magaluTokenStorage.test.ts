import assert from "node:assert/strict";
import { test } from "node:test";
import { MagaluHttpError } from "./magaluHttpError";
import { createMagaluTokenStorage, type MagaluTokenDatabase, type MagaluTokenAccount, type MagaluSavedTokens } from "./magaluTokenStorage";

test("persistência bloqueia a conta e atualiza access/refresh/expiração juntos em uma transação", async () => {
  const account: MagaluTokenAccount = {
    id: "id-ficticio", platform: "MAGALU", userId: "usuario-ficticio", externalAccountId: "tenant-ficticio", isActive: true,
    accessTokenEncrypted: "access-antigo-criptografado", refreshTokenEncrypted: "refresh-antigo-criptografado", tokenExpiresAt: new Date(0),
  };
  const saved: MagaluSavedTokens = { accessTokenEncrypted: "access-novo-criptografado", refreshTokenEncrypted: "refresh-novo-criptografado", tokenExpiresAt: new Date(7200_000) };
  const steps: string[] = [];
  const db: MagaluTokenDatabase = {
    marketplaceAccount: {
      findUnique: async () => account,
      updateMany: async (args) => {
        steps.push("save");
        assert.deepEqual(args.where, { id: account.id, platform: "MAGALU", isActive: true, userId: account.userId,
          accessTokenEncrypted: account.accessTokenEncrypted, refreshTokenEncrypted: account.refreshTokenEncrypted });
        assert.deepEqual(args.data, saved);
        return { count: 1 };
      },
    },
    async $transaction(work, options) {
      assert.equal(options.timeout, 25_000);
      assert.equal(options.maxWait, 10_000);
      steps.push("begin");
      const result = await work({
        marketplaceAccount: {
          ...db.marketplaceAccount,
          findUnique: async () => { steps.push("read"); return account; },
        },
        async $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]) {
          steps.push("lock");
          assert.equal(query.join("?"), "SELECT id FROM marketplace_accounts WHERE id = ? FOR UPDATE");
          assert.deepEqual(values, [account.id]);
          return [] as T;
        },
      });
      steps.push("commit");
      return result;
    },
  };
  const storage = createMagaluTokenStorage(db);
  const result = await storage.withLockedAccount(account.id, async (current, save) => {
    assert.equal(current, account);
    steps.push("refresh");
    await save(saved);
    return "result-after-commit";
  });
  steps.push(result);
  assert.deepEqual(steps, ["begin", "lock", "read", "refresh", "save", "commit", "result-after-commit"]);
});

test("atualização sem conta correspondente falha sem retornar credenciais novas", async () => {
  const account: MagaluTokenAccount = {
    id: "id-ficticio", platform: "MAGALU", userId: "usuario-ficticio", externalAccountId: "tenant-ficticio", isActive: true,
    accessTokenEncrypted: "access-antigo", refreshTokenEncrypted: "refresh-antigo", tokenExpiresAt: new Date(0),
  };
  const db: MagaluTokenDatabase = {
    marketplaceAccount: { findUnique: async () => account, updateMany: async () => ({ count: 0 }) },
    $transaction: async (work) => work({ marketplaceAccount: db.marketplaceAccount, $queryRaw: async <T>() => [] as T }),
  };
  const storage = createMagaluTokenStorage(db);
  await assert.rejects(storage.withLockedAccount(account.id, async (_account, save) => {
    await save({ accessTokenEncrypted: "novo", refreshTokenEncrypted: "novo", tokenExpiresAt: new Date() });
  }), (error: unknown) => error instanceof MagaluHttpError && error.code === "account_changed");
});
