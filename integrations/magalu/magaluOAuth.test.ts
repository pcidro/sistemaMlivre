import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { AppError } from "../../errors/AppError";
import { decryptToken } from "../../utils/tokenEncryption";
import { MagaluOAuthService } from "./MagaluOAuthService";
import { MagaluOAuthClient } from "./magaluOAuthClient";
import { getMagaluOAuthConfig, MAGALU_OAUTH_SCOPES } from "./magaluOAuthConfig";
import { MemoryMagaluStorage, testUserId, otherUserId, tenantId, oauthTestConfig, oauthTestEnv, tokenFixture } from "./magaluOAuthTestSupport";

function setup(fetchFn: typeof fetch = async () => Response.json(tokenFixture())) {
  const storage = new MemoryMagaluStorage();
  const service = new MagaluOAuthService(new MagaluOAuthClient(fetchFn), storage, () => oauthTestConfig);
  return { service, storage };
}

test("code recusado descarta o stream externo sem ler ou expor seu conteúdo", async () => {
  let discarded = false;
  const marker = "secret-refresh-token-ficticio";
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode(marker)); },
    cancel() { discarded = true; },
  });
  const { service, storage } = setup(async () => new Response(stream, { status: 400 }));
  const session = await service.createAuthorization(testUserId);
  await assert.rejects(service.completeAuthorization({ state: session.stateCookieValue, code: "code-invalido-ficticio" }, session.stateCookieValue), error => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 502);
    assert.ok(!error.message.includes(marker));
    return true;
  });
  assert.equal(discarded, true);
  assert.equal(storage.accounts.size, 0);
});

test("consentimento oficial solicita apenas leitura, code e seleção de tenant", async () => {
  const { service, storage } = setup();
  const session = await service.createAuthorization(testUserId);
  const url = new URL(session.authorizationUrl);
  assert.equal(url.origin + url.pathname, "https://id.magalu.com/login");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("choose_tenants"), "true");
  assert.equal(url.searchParams.get("scope"), MAGALU_OAUTH_SCOPES.join(" "));
  assert.equal(url.searchParams.get("redirect_uri"), oauthTestConfig.redirectUri);
  assert.match(session.stateCookieValue, /^[a-f0-9]{64}$/);
  assert.equal(url.searchParams.get("state"), session.stateCookieValue);
  assert.equal(storage.findState(session.stateCookieValue)?.userId, testUserId);
  assert.equal(storage.states.has(session.stateCookieValue), false);
  assert.ok(!session.authorizationUrl.includes(oauthTestConfig.clientSecret));
  const another = await service.createAuthorization(testUserId);
  assert.notEqual(another.stateCookieValue, session.stateCookieValue);
});

test("state válido troca code no endpoint oficial e persiste ambos tokens criptografados", async (t) => {
  const previousKey = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  t.after(() => { if (previousKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY; else process.env.TOKEN_ENCRYPTION_KEY = previousKey; });
  const tokens = tokenFixture();
  let requests = 0;
  const { service, storage } = setup(async (url, options) => {
    requests++;
    assert.equal(url, "https://id.magalu.com/oauth/token");
    assert.equal(options?.method, "POST");
    assert.equal(options?.redirect, "error");
    assert.ok(options?.signal);
    assert.deepEqual(options?.headers, { "Content-Type": "application/json", Accept: "application/json" });
    assert.deepEqual(JSON.parse(String(options?.body)), {
      client_id: oauthTestConfig.clientId, client_secret: oauthTestConfig.clientSecret,
      redirect_uri: oauthTestConfig.redirectUri, code: "code-ficticio", grant_type: "authorization_code",
    });
    return Response.json(tokens);
  });
  const { stateCookieValue: state } = await service.createAuthorization(testUserId);
  assert.equal(await service.completeAuthorization({ state, code: "code-ficticio" }, state), undefined);
  const account = storage.accounts.get(tenantId)!;
  assert.equal(account.userId, testUserId);
  assert.match(account.accessTokenEncrypted, /^v1\./);
  assert.match(account.refreshTokenEncrypted, /^v1\./);
  assert.notEqual(account.accessTokenEncrypted, tokens.access_token);
  assert.notEqual(account.refreshTokenEncrypted, tokens.refresh_token);
  assert.equal(decryptToken(account.accessTokenEncrypted), tokens.access_token);
  assert.equal(decryptToken(account.refreshTokenEncrypted), tokens.refresh_token);
  assert.ok(account.tokenExpiresAt.getTime() > Date.now() + 7_190_000);
  assert.equal(storage.states.size, 0);
  await assert.rejects(service.completeAuthorization({ state, code: "code-ficticio" }, state), /já utilizado/);
  assert.equal(requests, 1);
});

test("state inválido, expirado, ausente ou sem cookie não chega ao provedor", async () => {
  let requests = 0;
  const { service, storage } = setup(async () => { requests++; return Response.json(tokenFixture()); });
  const { stateCookieValue: state } = await service.createAuthorization(testUserId);
  for (const [received, cookie] of [["invalido", state], [state, undefined], ["a".repeat(64), state], [state, "a".repeat(64)], ["b".repeat(64), "b".repeat(64)]] as const) {
    await assert.rejects(service.completeAuthorization({ state: received, code: "code" }, cookie), /State OAuth/);
  }
  storage.findState(state)!.expiresAt = new Date(Date.now() - 1);
  await assert.rejects(service.completeAuthorization({ state, code: "code" }, state), /expirado/);
  assert.equal(requests, 0);
});

test("state não pode ser consumido em ambiente ou client diferente", async () => {
  const { service, storage } = setup();
  const { stateCookieValue: state } = await service.createAuthorization(testUserId);
  const changed = new MagaluOAuthService(new MagaluOAuthClient(), storage, () => ({ ...oauthTestConfig, environment: "production" }));
  await assert.rejects(changed.completeAuthorization({ state, code: "code" }, state), /State OAuth/);
});

test("callback sem code ou com recusa consome state sem trocar tokens", async () => {
  let requests = 0;
  const { service, storage } = setup(async () => { requests++; throw new Error("não deve chamar"); });
  for (const error of [undefined, "access_denied"]) {
    const { stateCookieValue: state } = await service.createAuthorization(testUserId);
    await assert.rejects(service.completeAuthorization(error ? { state, error } : { state }, state), /ausente|não foi concedida/);
    assert.equal(storage.findState(state), undefined);
  }
  assert.equal(requests, 0);
});

test("dois callbacks simultâneos só trocam um code", async () => {
  let requests = 0;
  const { service } = setup(async () => { requests++; return new Response("secret-ficticio", { status: 400 }); });
  const { stateCookieValue: state } = await service.createAuthorization(testUserId);
  const results = await Promise.allSettled([
    service.completeAuthorization({ state, code: "code" }, state),
    service.completeAuthorization({ state, code: "code" }, state),
  ]);
  assert.ok(results.every((result) => result.status === "rejected"));
  assert.equal(requests, 1);
});

test("erro da troca e falha de rede não expõem secrets e exigem novo state", async () => {
  for (const fetchFn of [async () => new Response("secret-ficticio access_token refresh_token", { status: 400 }),
    async () => { throw new Error("secret-ficticio"); }] as typeof fetch[]) {
    const { service, storage } = setup(fetchFn);
    const { stateCookieValue: state } = await service.createAuthorization(testUserId);
    await assert.rejects(service.completeAuthorization({ state, code: "code" }, state), (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 502);
      assert.ok(!error.message.includes("secret-ficticio"));
      return true;
    });
    assert.equal(storage.accounts.size, 0);
    assert.equal(storage.findState(state), undefined);
  }
});

test("não aceita JWT sem subject, vencido, audience divergente ou scopes insuficientes", async () => {
  const invalidResponses = [tokenFixture({ sub: undefined }), tokenFixture({ exp: 1 }),
    tokenFixture({ aud: "https://outro.example" }), { ...tokenFixture(), access_token: "invalido" },
    { ...tokenFixture(), scope: MAGALU_OAUTH_SCOPES[0] }, { ...tokenFixture(), refresh_token: "" },
    { ...tokenFixture(), created_at: Math.floor(Date.now() / 1000) + 3600 }];
  for (const tokens of invalidResponses) {
    const client = new MagaluOAuthClient(async () => Response.json(tokens));
    await assert.rejects(client.exchangeAuthorizationCode("code", oauthTestConfig), /troca do código/);
  }
});

test("expiração usa o menor prazo entre expires_in e exp do JWT", async () => {
  const exp = Math.floor(Date.now() / 1000) + 120;
  const client = new MagaluOAuthClient(async () => Response.json(tokenFixture({ exp })));
  const result = await client.exchangeAuthorizationCode("code", oauthTestConfig);
  assert.equal(result.tokenExpiresAt.getTime(), exp * 1000);
});

test("não salva tokens quando a chave de criptografia é inválida", async (t) => {
  const previousKey = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = "invalida";
  t.after(() => { if (previousKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY; else process.env.TOKEN_ENCRYPTION_KEY = previousKey; });
  const { service, storage } = setup();
  const { stateCookieValue: state } = await service.createAuthorization(testUserId);
  await assert.rejects(service.completeAuthorization({ state, code: "code" }, state), /proteção dos tokens inválida/);
  assert.equal(storage.accounts.size, 0);
});

test("reconexão não transfere conta de outro usuário", async (t) => {
  const previousKey = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  t.after(() => { if (previousKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY; else process.env.TOKEN_ENCRYPTION_KEY = previousKey; });
  const { service, storage } = setup();
  const first = await service.createAuthorization(testUserId);
  await service.completeAuthorization({ state: first.stateCookieValue, code: "code" }, first.stateCookieValue);
  const account = storage.accounts.get(tenantId);
  const second = await service.createAuthorization(otherUserId);
  await assert.rejects(service.completeAuthorization({ state: second.stateCookieValue, code: "code" }, second.stateCookieValue), (error: unknown) => error instanceof AppError && error.statusCode === 409);
  assert.equal(storage.accounts.get(tenantId), account);
  const reconnect = await service.createAuthorization(testUserId);
  await service.completeAuthorization({ state: reconnect.stateCookieValue, code: "code" }, reconnect.stateCookieValue);
  assert.equal(storage.accounts.size, 1);
});

test("usuário removido após connect não pode salvar uma conta", async () => {
  const { service, storage } = setup();
  const { stateCookieValue: state } = await service.createAuthorization(testUserId);
  storage.users.delete(testUserId);
  await assert.rejects(service.completeAuthorization({ state, code: "code" }, state), (error: unknown) => error instanceof AppError && error.statusCode === 401);
  assert.equal(storage.accounts.size, 0);
});

test("configuração bloqueia host não oficial e callback inseguro", () => {
  for (const patch of [
    { MAGALU_AUTH_URL: "https://attacker.example" }, { MAGALU_AUTH_URL: "invalid" },
    { MAGALU_AUTH_URL: "https://id.magalu.com/oauth/token" },
    { MAGALU_REDIRECT_URI: "http://example.com/api/marketplace-accounts/magalu/callback" },
    { MAGALU_REDIRECT_URI: oauthTestEnv.MAGALU_REDIRECT_URI + "?code=secret-ficticio" },
    { MAGALU_CLIENT_SECRET: "" },
  ]) assert.throws(() => getMagaluOAuthConfig({ ...oauthTestEnv, ...patch }), AppError);
  const local = "http://localhost:3333/api/marketplace-accounts/magalu/callback";
  const proxied = "https://mlivrefrontend.onrender.com/api/marketplace-accounts/magalu/callback";
  assert.equal(getMagaluOAuthConfig({ ...oauthTestEnv, MAGALU_REDIRECT_URI: proxied }).redirectUri, proxied);
  assert.equal(getMagaluOAuthConfig({ ...oauthTestEnv, MAGALU_REDIRECT_URI: local }).redirectUri, local);
  assert.throws(() => getMagaluOAuthConfig({ ...oauthTestEnv, NODE_ENV: "production", MAGALU_REDIRECT_URI: local }), AppError);
});
