import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import { DisconnectMercadoLivreAccountService } from "./disconnectMercadoLivreAccountService";

test("revoga a autorização antes de limpar os tokens da conta", async () => {
  const operations: string[] = [];
  const service = new DisconnectMercadoLivreAccountService({
    findOwnedAccount: async (accountId, userId) => {
      assert.equal(accountId, "account-id");
      assert.equal(userId, "user-id");
      return { id: accountId, externalAccountId: "123456789" };
    },
    getValidAccessToken: async (accountId) => {
      operations.push(`token:${accountId}`);
      return "access-token";
    },
    revokeAuthorization: async (externalAccountId, accessToken) => {
      operations.push(`revoke:${externalAccountId}:${accessToken}`);
    },
    clearCredentials: async (accountId) => {
      operations.push(`clear:${accountId}`);
    },
  });

  await service.execute("account-id", "user-id");

  assert.deepEqual(operations, [
    "token:account-id",
    "revoke:123456789:access-token",
    "clear:account-id",
  ]);
});

test("não revoga uma conta que não pertence ao usuário", async () => {
  let authorizationWasRevoked = false;
  const service = new DisconnectMercadoLivreAccountService({
    findOwnedAccount: async () => null,
    getValidAccessToken: async () => "access-token",
    revokeAuthorization: async () => {
      authorizationWasRevoked = true;
    },
    clearCredentials: async () => undefined,
  });

  await assert.rejects(
    () => service.execute("another-account", "user-id"),
    (error: unknown) =>
      error instanceof AppError && error.statusCode === 404,
  );
  assert.equal(authorizationWasRevoked, false);
});

test("não limpa os tokens locais quando a revogação externa falha", async () => {
  let credentialsWereCleared = false;
  const service = new DisconnectMercadoLivreAccountService({
    findOwnedAccount: async () => ({
      id: "account-id",
      externalAccountId: "123456789",
    }),
    getValidAccessToken: async () => "access-token",
    revokeAuthorization: async () => {
      throw new AppError("Mercado Livre indisponível", 503);
    },
    clearCredentials: async () => {
      credentialsWereCleared = true;
    },
  });

  await assert.rejects(
    () => service.execute("account-id", "user-id"),
    AppError,
  );
  assert.equal(credentialsWereCleared, false);
});
