import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, test } from "node:test";
import express from "express";
import type { Prisma } from "../../generated/prisma/client";

import { decryptToken } from "../../utils/tokenEncryption";
import { MercadoLivreOAuthClient } from "../../integrations/mercadolivre/mercadoLivreOAuthClient";
import { MercadoLivreOAuthService } from "../../integrations/mercadolivre/mercadoLivreOAuthService";
import { createMercadoLivreOAuthState, MERCADO_LIVRE_OAUTH_STATE_COOKIE } from "../../integrations/mercadolivre/mercadoLivreOAuthState";
import { MercadoLivreOAuthController } from "./mercadoLivreOAuthController";

const userId = "b337d0f4-a0a4-4d00-8f29-7800c3c53f62";
const fakeAccessToken = "access-token-never-log";
const fakeRefreshToken = "refresh-token-never-log";
const fakeCode = "authorization-code-never-log";
const keys = ["JWT_SECRET", "NODE_ENV", "FRONTEND_URL", "TOKEN_ENCRYPTION_KEY", "MERCADO_LIVRE_CLIENT_ID", "MERCADO_LIVRE_CLIENT_SECRET", "MERCADO_LIVRE_REDIRECT_URI"] as const;
const previousEnvironment = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const connectedAccount = {
  id: "account-id", platform: "MERCADO_LIVRE" as const, name: "Loja fictícia",
  cnpj: null, externalAccountId: "123", tokenExpiresAt: new Date(), isActive: true,
  createdAt: new Date(), updatedAt: new Date(),
};
const storage: NonNullable<ConstructorParameters<typeof MercadoLivreOAuthService>[1]> = {
  findUser: async () => ({ id: userId }),
  findAccount: async () => null,
  saveAccount: async () => connectedAccount,
};

beforeEach(() => {
  process.env.JWT_SECRET = "state-signing-secret-never-log";
  process.env.NODE_ENV = "production";
  process.env.FRONTEND_URL = "https://frontend.example";
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  process.env.MERCADO_LIVRE_CLIENT_ID = "123";
  process.env.MERCADO_LIVRE_CLIENT_SECRET = "client-secret-never-log";
  process.env.MERCADO_LIVRE_REDIRECT_URI = "https://frontend.example/api/marketplace-accounts/mercadolivre/callback";
});

afterEach(() => {
  for (const key of keys) {
    if (previousEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnvironment[key];
  }
});

interface FixtureOptions {
  tokenError?: string;
  tokenStatus?: number;
  accountStatus?: number;
  onSync?: (accountId: string, userId: string) => void;
  syncFails?: boolean;
}

async function withApi(work: (url: string) => Promise<void>, options: FixtureOptions = {}) {
  const fetchFn = (async (input) => {
    if (String(input).endsWith("/oauth/token")) {
      if (options.tokenError) return Response.json({ error: options.tokenError, error_description: fakeAccessToken }, { status: options.tokenStatus ?? 400 });
      return Response.json({ access_token: fakeAccessToken, refresh_token: fakeRefreshToken, user_id: 123, expires_in: 3600 });
    }
    assert.equal(String(input), "https://api.mercadolibre.com/users/me");
    if (options.accountStatus) return Response.json({ error: "forbidden", message: fakeAccessToken }, { status: options.accountStatus });
    return Response.json({ id: 123, nickname: "Loja fictícia" });
  }) as typeof fetch;
  const controller = new MercadoLivreOAuthController(new MercadoLivreOAuthService(new MercadoLivreOAuthClient(fetchFn), storage), {
    async start(accountId, initiatedBy) {
      options.onSync?.(accountId, initiatedBy);
      if (options.syncFails) throw new Error(fakeRefreshToken);
      return { id: "import-test", marketplaceAccountId: accountId, status: "PROCESSING", startedAt: new Date(), finishedAt: null,
        ordersFound: 0, ordersProcessed: 0, customersWithPhone: 0, customersWithoutPhone: 0, errorsCount: 0 };
    },
  });
  const app = express();
  app.get("/connect", (req, res) => { req.user_id = userId; return controller.connect(req, res); });
  app.get("/callback", (req, res) => controller.callback(req, res));
  const server = createServer(app);
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    await work(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function callbackRequest(baseUrl: string, cookie = true, query?: URLSearchParams) {
  const session = createMercadoLivreOAuthState(userId);
  return fetch(`${baseUrl}/callback?${query ?? new URLSearchParams({ code: fakeCode, state: session.state })}`, {
    redirect: "manual",
    headers: cookie ? { Cookie: `${MERCADO_LIVRE_OAUTH_STATE_COOKIE}=${encodeURIComponent(session.cookieValue)}` } : {},
  });
}

test("conexão emite cookie seguro e usa o callback do frontend", async () => {
  await withApi(async (url) => {
    const response = await fetch(`${url}/connect`, { redirect: "manual" });
    const cookie = response.headers.get("set-cookie") ?? "";
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Path=\/api\/marketplace-accounts\/mercadolivre\/callback/);
    const location = new URL(response.headers.get("location")!);
    assert.equal(location.searchParams.get("redirect_uri"), process.env.MERCADO_LIVRE_REDIRECT_URI);
  });
});

test("callback salva tokens criptografados e sinaliza sucesso somente após persistir", async (context) => {
  const save = context.mock.method(storage, "saveAccount", async (args: Prisma.MarketplaceAccountUpsertArgs) => {
    assert.equal(args.create.userId, userId);
    assert.deepEqual(args.where.OR, [{ userId }, { userId: null }]);
    assert.ok(typeof args.create.accessTokenEncrypted === "string");
    assert.ok(typeof args.create.refreshTokenEncrypted === "string");
    assert.equal(decryptToken(args.create.accessTokenEncrypted), fakeAccessToken);
    assert.equal(decryptToken(args.create.refreshTokenEncrypted), fakeRefreshToken);
    assert.equal(args.select?.accessTokenEncrypted, undefined);
    return connectedAccount;
  });
  await withApi(async (url) => {
    const response = await callbackRequest(url);
    assert.equal(response.headers.get("location"), "https://frontend.example/marketplace-accounts?mercadolivre=success&import_id=import-test");
    assert.match(response.headers.get("set-cookie") ?? "", /Expires=Thu, 01 Jan 1970/);
    assert.equal(save.mock.callCount(), 1);
  }, { onSync: (accountId, initiatedBy) => {
    assert.equal(save.mock.callCount(), 1);
    assert.equal(accountId, connectedAccount.id);
    assert.equal(initiatedBy, userId);
  } });
});

const failures = [
  { reason: "state_missing", cookie: false },
  { reason: "state_invalid", query: { state: "wrong-state", code: fakeCode } },
  { reason: "authorization_denied", providerDenied: true },
  { reason: "callback_invalid", missingCode: true },
  { reason: "token_exchange_failed", tokenError: "invalid_client" },
  { reason: "token_exchange_failed", tokenError: "invalid_grant" },
  { reason: "token_exchange_failed", tokenError: "unauthorized_client" },
  { reason: "token_exchange_failed", tokenError: "unauthorized_application" },
  { reason: "token_exchange_failed", tokenError: "unrecognized-secret-never-log" },
  { reason: "account_lookup_failed", accountStatus: 403 },
  { reason: "account_already_linked", ownerId: "another-local-user" },
  { reason: "encryption_configuration", invalidEncryptionKey: true },
  { reason: "persistence_failed", databaseFails: true },
] as const;

for (const failure of failures) {
  test(`callback identifica ${failure.reason}${"tokenError" in failure ? ` (${failure.tokenError === "unrecognized-secret-never-log" ? "código desconhecido" : failure.tokenError})` : ""} sem vazar dados`, async (context) => {
    context.mock.method(storage, "findAccount", async () => "ownerId" in failure ? { userId: failure.ownerId } : null);
    const save = context.mock.method(storage, "saveAccount", async () => {
      if ("databaseFails" in failure) throw new Error(`Database error ${fakeAccessToken}`);
      throw new Error("Não deveria persistir neste teste");
    });
    const logger = context.mock.method(console, "error", () => {});
    if ("invalidEncryptionKey" in failure) process.env.TOKEN_ENCRYPTION_KEY = "invalid-key-never-log";
    await withApi(async (url) => {
      let response: Response;
      if ("providerDenied" in failure || "missingCode" in failure) {
        const session = createMercadoLivreOAuthState(userId);
        const params = new URLSearchParams({ state: session.state });
        if ("providerDenied" in failure) params.set("error", "access_denied");
        response = await fetch(`${url}/callback?${params}`, { redirect: "manual", headers: { Cookie: `${MERCADO_LIVRE_OAUTH_STATE_COOKIE}=${session.cookieValue}` } });
      } else {
        response = await callbackRequest(url, !("cookie" in failure), "query" in failure ? new URLSearchParams(failure.query) : undefined);
      }
      const location = response.headers.get("location")!;
      const params = new URL(location).searchParams;
      assert.equal(params.get("mercadolivre"), "error");
      assert.equal(params.get("mercadolivre_error"), failure.reason);
      assert.equal(save.mock.callCount(), "databaseFails" in failure ? 1 : 0);
      const log = logger.mock.calls[0]?.arguments[1];
      assert.equal(log.reason, failure.reason);
      if ("tokenError" in failure) {
        assert.equal(log.upstreamStatus, 400);
        assert.equal(log.upstreamError, failure.tokenError === "unrecognized-secret-never-log" ? null : failure.tokenError);
        if (failure.tokenError === "invalid_client") {
          assert.equal(log.credentialCheck.clientId, "123");
          assert.equal(log.credentialCheck.secretHasQuotes, false);
          assert.equal(log.credentialCheck.secretLooksMasked, false);
        } else {
          assert.equal(log.credentialCheck, undefined);
        }
      }
      const output = JSON.stringify(logger.mock.calls.map((call) => call.arguments)) + location + await response.text();
      for (const secret of [fakeAccessToken, fakeRefreshToken, fakeCode, "client-secret-never-log", "state-signing-secret-never-log", "unrecognized-secret-never-log", "invalid-key-never-log"]) assert.ok(!output.includes(secret));
    }, {
      onSync: () => { assert.fail("Callback inválido não pode iniciar sincronização"); },
      ...("tokenError" in failure ? { tokenError: failure.tokenError } : {}),
      ...("accountStatus" in failure ? { accountStatus: failure.accountStatus } : {}),
    });
  });
}

test("falha ao iniciar importação preserva OAuth salvo, sinaliza sucesso e não vaza erro", async context => {
  const logger = context.mock.method(console, "error", () => {});
  await withApi(async url => {
    const response = await callbackRequest(url);
    const location = response.headers.get("location")!;
    assert.equal(new URL(location).searchParams.get("mercadolivre"), "success");
    assert.equal(new URL(location).searchParams.get("sync_error"), "start_failed");
    assert.ok(!JSON.stringify(logger.mock.calls).includes(fakeRefreshToken));
  }, { syncFails: true });
});
