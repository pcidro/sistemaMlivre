import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { AppError } from "../../errors/AppError";
import { MercadoLivreOAuthClient } from "./mercadoLivreOAuthClient";
import { getMercadoLivreCredentialDiagnostics, getMercadoLivreOAuthDiagnostics } from "./mercadoLivreConfig";
import {
  createMercadoLivreOAuthState,
  validateMercadoLivreOAuthState,
} from "./mercadoLivreOAuthState";

const environmentKeys = [
  "JWT_SECRET",
  "MERCADO_LIVRE_CLIENT_ID",
  "MERCADO_LIVRE_CLIENT_SECRET",
  "MERCADO_LIVRE_REDIRECT_URI",
  "FRONTEND_URL",
] as const;

const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
);

beforeEach(() => {
  process.env.JWT_SECRET = "jwt-secret-for-tests";
  process.env.MERCADO_LIVRE_CLIENT_ID = "123456789";
  process.env.MERCADO_LIVRE_CLIENT_SECRET = "client-secret-for-tests";
  process.env.MERCADO_LIVRE_REDIRECT_URI =
    "https://example.com/api/marketplace-accounts/mercadolivre/callback";
});

afterEach(() => {
  for (const key of environmentKeys) {
    const originalValue = originalEnvironment[key];

    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
});

test("monta a URL oficial de autorização somente com parâmetros conhecidos", () => {
  const url = new URL(new MercadoLivreOAuthClient().getAuthorizationUrl("state"));

  assert.equal(url.origin, "https://auth.mercadolivre.com.br");
  assert.equal(url.pathname, "/authorization");
  assert.deepEqual([...url.searchParams.keys()].sort(), [
    "client_id",
    "redirect_uri",
    "response_type",
    "state",
  ]);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "123456789");
  assert.equal(url.searchParams.get("state"), "state");
});

test("valida o state e recupera o usuário que iniciou a conexão", () => {
  const userId = "b337d0f4-a0a4-4d00-8f29-7800c3c53f62";
  const session = createMercadoLivreOAuthState(userId);

  assert.deepEqual(
    validateMercadoLivreOAuthState(session.state, session.cookieValue),
    { userId },
  );
});

test("rejeita state diferente do que iniciou a conexão", () => {
  const session = createMercadoLivreOAuthState(
    "b337d0f4-a0a4-4d00-8f29-7800c3c53f62",
  );

  assert.throws(
    () =>
      validateMercadoLivreOAuthState(
        "outro-state",
        session.cookieValue,
      ),
    AppError,
  );
});

test("troca o authorization code sem enviar segredo pela URL", async () => {
  const mockFetch = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    const url = String(input);
    const body = init?.body;

    assert.equal(url, "https://api.mercadolibre.com/oauth/token");
    assert.equal(init?.method, "POST");
    assert.ok(body instanceof URLSearchParams);
    assert.equal(body.get("grant_type"), "authorization_code");
    assert.equal(body.get("code"), "authorization-code");
    assert.equal(body.get("client_secret"), "client-secret-for-tests");
    assert.equal(new URL(url).search, "");

    return new Response(
      JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 21600,
        user_id: 123456789,
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  const client = new MercadoLivreOAuthClient(mockFetch);
  const tokenSet = await client.exchangeAuthorizationCode(
    "authorization-code",
  );

  assert.deepEqual(tokenSet, {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresInSeconds: 21600,
    userId: "123456789",
  });
});

test("renova o token e preserva o novo refresh token retornado", async () => {
  const mockFetch = (async (
    _input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    const body = init?.body;

    assert.ok(body instanceof URLSearchParams);
    assert.equal(body.get("grant_type"), "refresh_token");
    assert.equal(body.get("refresh_token"), "old-refresh-token");

    return new Response(
      JSON.stringify({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 21600,
        user_id: "123456789",
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  const tokenSet = await new MercadoLivreOAuthClient(
    mockFetch,
  ).refreshAccessToken("old-refresh-token");

  assert.equal(tokenSet.accessToken, "new-access-token");
  assert.equal(tokenSet.refreshToken, "new-refresh-token");
});

test("diagnóstico identifica cópia malformada sem retornar Secret, código ou fingerprint", () => {
  process.env.MERCADO_LIVRE_CLIENT_ID = "123456789";
  process.env.MERCADO_LIVRE_CLIENT_SECRET = '"secret-ficticio\u200b com espaços"';
  const diagnostics = getMercadoLivreCredentialDiagnostics();
  assert.equal(diagnostics.clientId, "123456789");
  assert.equal(diagnostics.secretHasWhitespace, true);
  assert.equal(diagnostics.secretHasNonAscii, true);
  assert.equal(diagnostics.secretHasQuotes, true);
  assert.equal(diagnostics.secretLooksMasked, false);
  assert.ok(!JSON.stringify(diagnostics).includes("secret-ficticio"));
  assert.deepEqual(Object.keys(diagnostics).sort(), ["clientId", "clientIdLooksValid", "secretLength", "secretHasWhitespace", "secretHasNonAscii", "secretHasQuotes", "secretLooksMasked"].sort());
  process.env.MERCADO_LIVRE_CLIENT_SECRET = "••••••••";
  assert.equal(getMercadoLivreCredentialDiagnostics().secretLooksMasked, true);
  process.env.MERCADO_LIVRE_CLIENT_ID = "secret-colado-no-campo-id";
  assert.equal(getMercadoLivreCredentialDiagnostics().clientId, null);
  assert.ok(!JSON.stringify(getMercadoLivreCredentialDiagnostics()).includes("secret-colado-no-campo-id"));
});

test("diagnóstico detecta callback em outro domínio sem expor URLs ou valores sensíveis", () => {
  process.env.FRONTEND_URL = "https://frontend.example";
  process.env.MERCADO_LIVRE_REDIRECT_URI = "https://backend.example/api/marketplace-accounts/mercadolivre/callback";
  const diagnostics = getMercadoLivreOAuthDiagnostics();
  assert.equal(diagnostics.callbackUsesFrontendOrigin, false);
  assert.equal(diagnostics.callbackUsesExpectedPath, true);
  assert.equal(diagnostics.callbackUsesHttps, true);
  process.env.MERCADO_LIVRE_REDIRECT_URI = "https://frontend.example/api/marketplace-accounts/mercadolivre/callback";
  assert.equal(getMercadoLivreOAuthDiagnostics().callbackUsesFrontendOrigin, true);
  process.env.MERCADO_LIVRE_REDIRECT_URI = "https://private-user:private-password@backend.example/private-path?code=private-code#private-fragment";
  const unsafeUrlDiagnostics = getMercadoLivreOAuthDiagnostics();
  assert.equal(unsafeUrlDiagnostics.callbackHasUrlCredentials, true);
  assert.equal(unsafeUrlDiagnostics.callbackHasQueryOrFragment, true);
  assert.equal(unsafeUrlDiagnostics.callbackUsesExpectedPath, false);
  const output = JSON.stringify(unsafeUrlDiagnostics);
  for (const value of ["private-user", "private-password", "private-path", "private-code", "private-fragment", "client-secret-for-tests", "jwt-secret-for-tests"]) {
    assert.ok(!output.includes(value));
  }
});

test("diagnóstico trata variáveis ausentes ou inválidas sem ecoar a entrada", () => {
  process.env.FRONTEND_URL = "not-a-url-private";
  process.env.MERCADO_LIVRE_REDIRECT_URI = "invalid-redirect-private";
  delete process.env.JWT_SECRET;
  delete process.env.MERCADO_LIVRE_CLIENT_SECRET;
  const diagnostics = getMercadoLivreOAuthDiagnostics();
  assert.equal(diagnostics.oauthVariablesValid, false);
  assert.equal(diagnostics.frontendUrlValid, false);
  assert.equal(diagnostics.callbackUrlValid, false);
  assert.equal(diagnostics.callbackUsesFrontendOrigin, null);
  assert.equal(diagnostics.jwtSecretConfigured, false);
  assert.ok(!JSON.stringify(diagnostics).includes("private"));
});

test("envia exatamente o mesmo ID, Secret e redirect na troca do código, incluindo caracteres especiais", async () => {
  const fakeSecret = "secret-ficticio+&=/";
  process.env.MERCADO_LIVRE_CLIENT_SECRET = fakeSecret;
  const client = new MercadoLivreOAuthClient((async (_url, init) => {
    assert.ok(init?.body instanceof URLSearchParams);
    const body = new URLSearchParams(init.body.toString());
    assert.equal(body.get("client_id"), process.env.MERCADO_LIVRE_CLIENT_ID);
    assert.equal(body.get("client_secret"), fakeSecret);
    assert.equal(body.get("redirect_uri"), process.env.MERCADO_LIVRE_REDIRECT_URI);
    return Response.json({ access_token: "access-ficticio", refresh_token: "refresh-ficticio", user_id: 123, expires_in: 3600 });
  }) as typeof fetch);
  await client.exchangeAuthorizationCode("code-ficticio");
});

test("revoga a autorização sem enviar o token pela URL", async () => {
  const mockFetch = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);

    assert.equal(init?.method, "DELETE");
    assert.equal(
      url.toString(),
      "https://api.mercadolibre.com/users/123456789/applications/123456789",
    );
    assert.equal(headers.get("Authorization"), "Bearer access-token");
    assert.equal(url.searchParams.has("access_token"), false);

    return new Response(null, { status: 204 });
  }) as typeof fetch;

  await new MercadoLivreOAuthClient(mockFetch).revokeAuthorization(
    "123456789",
    "access-token",
  );
});
