import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test, type TestContext } from "node:test";
import { encryptToken, decryptToken } from "../../utils/tokenEncryption";
import { MagaluClient } from "./MagaluClient";
import { MagaluTokenService } from "./MagaluTokenService";
import { MagaluOAuthClient } from "./magaluOAuthClient";
import { MagaluRequestLimiter } from "./MagaluRequestLimiter";
import { MagaluHttpError } from "./magaluHttpError";
import { getMagaluConfig } from "./magaluConfig";
import { oauthTestConfig, oauthTestEnv, tenantId, testUserId, tokenFixture } from "./magaluOAuthTestSupport";
import type { MagaluTokenStorage, MagaluTokenAccount, MagaluSavedTokens } from "./magaluTokenStorage";

const traceId = "11111111-1111-4111-8111-111111111111";

class MemoryTokenStorage implements MagaluTokenStorage {
  commitFailures = 0;
  readonly writes: MagaluSavedTokens[] = [];
  private queue: Promise<void> = Promise.resolve();
  constructor(public account: MagaluTokenAccount) {}
  async findAccount() { return { ...this.account }; }
  async withLockedAccount<T>(_id: string, work: (account: MagaluTokenAccount | null, save: (tokens: MagaluSavedTokens) => Promise<void>) => Promise<T>): Promise<T> {
    const turn = this.queue.then(async () => {
      const original = { ...this.account };
      let next: MagaluSavedTokens | undefined;
      const result = await work(original, async (tokens) => { this.writes.push(tokens); next = tokens; });
      if (this.commitFailures > 0) { this.commitFailures--; throw new Error("erro banco com dados sensíveis-ficticios"); }
      if (next) this.account = { ...this.account, ...next };
      return result;
    });
    this.queue = turn.then(() => {}, () => {});
    return turn;
  }
}

function setup(t: TestContext, options: { expired?: boolean; api?: typeof fetch; oauth?: typeof fetch; production?: boolean } = {}) {
  const previousKey = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  t.after(() => { if (previousKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY; else process.env.TOKEN_ENCRYPTION_KEY = previousKey; });
  const audience = options.production ? "https://api.magalu.com" : "https://api-sandbox.magalu.com";
  const originalToken = tokenFixture({ jti: "original", aud: audience }).access_token;
  const refreshed = tokenFixture({ jti: "renovado", aud: audience });
  const original: MagaluTokenAccount = {
    id: "00000000-0000-4000-8000-000000000004", platform: "MAGALU", externalAccountId: tenantId,
    userId: testUserId, isActive: true, accessTokenEncrypted: encryptToken(originalToken),
    refreshTokenEncrypted: encryptToken("refresh-original-ficticio"),
    tokenExpiresAt: new Date(Date.now() + (options.expired ? -1000 : 7200_000)),
  };
  const storage = new MemoryTokenStorage(original);
  let clock = Date.now();
  const now = () => clock;
  const delays: number[] = [];
  const limiter = new MagaluRequestLimiter({ nowFn: now, sleepFn: async (ms) => {
    delays.push(ms);
    await new Promise<void>((resolve) => setImmediate(resolve));
    clock += ms;
  } });
  const config = { ...oauthTestConfig, audience, environment: options.production ? "production" as const : "sandbox" as const };
  let refreshCalls = 0;
  const oauth = new MagaluOAuthClient(async (input, init) => {
    refreshCalls++;
    return options.oauth ? options.oauth(input, init) : Response.json(refreshed);
  });
  const tokens = new MagaluTokenService(oauth, storage, now);
  const calls: { url: string; init: RequestInit | undefined; at: number }[] = [];
  const api: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init, at: now() });
    return options.api ? options.api(input, init) : Response.json({ ok: true }, { headers: { "X-Request-ID": traceId } });
  };
  const dependencies = {
    fetchFn: api, tokenService: tokens, limiter, nowFn: now,
    getConfig: () => getMagaluConfig({ ...oauthTestEnv, MAGALU_ENV: config.environment }),
    getOAuthConfig: () => config,
  };
  return { client: new MagaluClient(original, dependencies), newClient: () => new MagaluClient(original, dependencies),
    original, originalToken, refreshed, storage, tokens, config, calls, delays, now, refreshCalls: () => refreshCalls };
}

function isError(code: MagaluHttpError["code"], status?: number) {
  return (error: unknown) => error instanceof MagaluHttpError && error.code === code && (status === undefined || error.providerStatus === status);
}

test("token válido usa Bearer, base sandbox e X-Request-ID sem refresh", async (t) => {
  const fixture = setup(t);
  const response = await fixture.client.get<{ ok: boolean }>("/recurso-teste", { query: { page: 2, active: true }, headers: { Authorization: "indevido", Cookie: "segredo" } });
  assert.equal(fixture.calls[0]?.url, "https://api-sandbox.magalu.com/recurso-teste?page=2&active=true");
  const headers = new Headers(fixture.calls[0]?.init?.headers);
  assert.equal(headers.get("authorization"), `Bearer ${fixture.originalToken}`);
  assert.match(headers.get("x-request-id")!, /^[0-9a-f-]{36}$/);
  assert.equal(headers.get("cookie"), null);
  assert.equal(fixture.calls[0]?.init?.redirect, "error");
  assert.ok(fixture.calls[0]?.init?.signal);
  assert.deepEqual(response, { data: { ok: true }, status: 200, requestId: traceId });
  assert.equal(fixture.refreshCalls(), 0);
});

test("produção usa somente base oficial de produção", async (t) => {
  const { client, calls } = setup(t, { production: true });
  await client.get("/recurso-teste");
  assert.equal(calls[0]?.url, "https://api.magalu.com/recurso-teste");
});

test("token expirado renova pelo formulário oficial e salva os dois tokens antes da chamada", async (t) => {
  const refreshed = tokenFixture({ jti: "novo" });
  const fixture = setup(t, { expired: true, oauth: async (input, init) => {
    assert.equal(input, "https://id.magalu.com/oauth/token");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("content-type"), "application/x-www-form-urlencoded");
    assert.ok(init?.body instanceof URLSearchParams);
    assert.deepEqual(Object.fromEntries(init.body), { grant_type: "refresh_token", client_id: oauthTestConfig.clientId,
      client_secret: oauthTestConfig.clientSecret, refresh_token: "refresh-original-ficticio" });
    assert.equal(init.redirect, "error");
    return Response.json(refreshed);
  }, api: async (_input, init) => {
    assert.equal(decryptToken(fixture.storage.account.accessTokenEncrypted), refreshed.access_token);
    assert.equal(decryptToken(fixture.storage.account.refreshTokenEncrypted!), refreshed.refresh_token);
    assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${refreshed.access_token}`);
    return Response.json({ ok: true });
  } });
  await fixture.client.get("/recurso-teste");
  assert.equal(fixture.refreshCalls(), 1);
  assert.equal(fixture.storage.writes.length, 1);
  assert.match(fixture.storage.account.refreshTokenEncrypted!, /^v1\./);
  assert.ok(fixture.storage.account.tokenExpiresAt!.getTime() > Date.now() + 7190_000);
});

test("refresh sem novo refresh_token mantém exatamente o refresh criptografado existente", async (t) => {
  const { refresh_token: _unused, ...tokens } = tokenFixture({ jti: "novo" });
  const fixture = setup(t, { expired: true, oauth: async () => Response.json(tokens) });
  const previous = fixture.original.refreshTokenEncrypted;
  await fixture.client.get("/recurso-teste");
  assert.equal(fixture.storage.account.refreshTokenEncrypted, previous);
  assert.equal(decryptToken(previous!), "refresh-original-ficticio");
});

test("falha de refresh preserva tokens antigos, request ID e não chama API", async (t) => {
  for (const status of [400, 401, 403, 429, 500, 503]) {
    const fixture = setup(t, { expired: true, oauth: async () => Response.json({ secret: "dado-sensível-ficticio" },
      { status, headers: { "X-Request-ID": traceId } }) });
    await assert.rejects(fixture.client.get("/recurso-teste"), (error: unknown) => {
      assert.ok(error instanceof MagaluHttpError);
      assert.equal(error.providerStatus, status);
      assert.equal(error.requestId, traceId);
      assert.ok(!JSON.stringify(error).includes("dado-sensível"));
      return true;
    });
    assert.equal(fixture.storage.account.accessTokenEncrypted, fixture.original.accessTokenEncrypted);
    assert.equal(fixture.storage.account.refreshTokenEncrypted, fixture.original.refreshTokenEncrypted);
    assert.equal(fixture.storage.writes.length, 0);
    assert.equal(fixture.refreshCalls(), 1);
    assert.equal(fixture.calls.length, 0);
  }
});

test("falha de COMMIT mantém banco intacto e recupera novo refresh sem repetir a renovação", async (t) => {
  const fixture = setup(t, { expired: true });
  fixture.storage.commitFailures = 1;
  await assert.rejects(fixture.client.get("/recurso-teste"), isError("token_persistence"));
  assert.equal(fixture.storage.account.refreshTokenEncrypted, fixture.original.refreshTokenEncrypted);
  assert.equal(fixture.calls.length, 0);
  assert.equal(fixture.refreshCalls(), 1);
  await fixture.newClient().get("/recurso-teste");
  assert.equal(fixture.refreshCalls(), 1);
  assert.equal(decryptToken(fixture.storage.account.refreshTokenEncrypted!), fixture.refreshed.refresh_token);
  assert.equal(fixture.calls.length, 1);
});

test("clients concorrentes compartilham uma renovação e mantêm chamadas espaçadas", async (t) => {
  const fixture = setup(t, { expired: true });
  await Promise.all([fixture.client.get("/recurso-teste"), fixture.newClient().get("/recurso-teste")]);
  assert.equal(fixture.refreshCalls(), 1);
  assert.equal(fixture.storage.writes.length, 1);
  assert.equal(fixture.calls.length, 2);
  assert.ok(fixture.calls[1]!.at - fixture.calls[0]!.at >= 250);
});

test("401 renova uma vez e repete leitura com o novo token", async (t) => {
  let count = 0;
  const fixture = setup(t, { api: async () => ++count === 1 ? new Response("sensível-ficticio", { status: 401 }) : Response.json({ ok: true }) });
  await fixture.client.get("/recurso-teste");
  assert.equal(fixture.calls.length, 2);
  assert.equal(fixture.refreshCalls(), 1);
  assert.equal(new Headers(fixture.calls[1]?.init?.headers).get("authorization"), `Bearer ${fixture.refreshed.access_token}`);
});

test("401 persistente encerra após uma renovação", async (t) => {
  const fixture = setup(t, { api: async () => new Response("sensível-ficticio", { status: 401 }) });
  await assert.rejects(fixture.client.get("/recurso-teste"), isError("unauthorized", 401));
  assert.equal(fixture.calls.length, 2);
  assert.equal(fixture.refreshCalls(), 1);
});

test("400, 403 e 404 retornam erros compreensíveis sem retry ou body externo", async (t) => {
  for (const [status, code] of [[400, "bad_request"], [403, "forbidden"], [404, "not_found"]] as const) {
    const fixture = setup(t, { api: async () => Response.json({ phone: "telefone-ficticio", access_token: "token-ficticio" }, { status, headers: { "X-Request-ID": traceId } }) });
    await assert.rejects(fixture.client.get("/recurso-teste"), (error: unknown) => {
      assert.ok(error instanceof MagaluHttpError);
      assert.equal(error.code, code);
      assert.equal(error.requestId, traceId);
      assert.ok(!JSON.stringify(error).includes("telefone-ficticio"));
      assert.ok(!JSON.stringify(error).includes("token-ficticio"));
      return true;
    });
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.refreshCalls(), 0);
  }
});

test("429 respeita Retry-After em segundos e HTTP-date", async (t) => {
  for (const retryAfter of ["2", new Date(Date.now() + 4000).toUTCString()]) {
    let count = 0;
    const fixture = setup(t, { api: async () => ++count === 1
      ? new Response("sensível-ficticio", { status: 429, headers: { "Retry-After": retryAfter, "X-Request-ID": traceId } })
      : Response.json({ ok: true }) });
    await fixture.client.get("/recurso-teste");
    const expectedDelay = retryAfter === "2" ? 2000 : Date.parse(retryAfter) - fixture.calls[0]!.at;
    assert.ok(fixture.calls[1]!.at - fixture.calls[0]!.at >= expectedDelay);
    assert.equal(fixture.calls.length, 2);
  }
});

test("429 com pausa longa encerra sem antecipar chamada e bloqueia outros clients", async (t) => {
  const fixture = setup(t, { api: async () => new Response(null, { status: 429, headers: { "Retry-After": "120", "X-Request-ID": traceId } }) });
  await assert.rejects(fixture.client.get("/recurso-teste"), (error: unknown) => {
    assert.ok(error instanceof MagaluHttpError);
    assert.equal(error.code, "rate_limited");
    assert.equal(error.retryAfterMs, 120_000);
    assert.equal(error.requestId, traceId);
    return true;
  });
  await assert.rejects(fixture.newClient().get("/recurso-teste"), isError("rate_limited"));
  assert.equal(fixture.calls.length, 1);
});

test("500/503 temporários se recuperam; persistentes param após três chamadas", async (t) => {
  for (const status of [500, 503]) {
    let count = 0;
    const recovered = setup(t, { api: async () => ++count === 1 ? new Response(null, { status }) : Response.json({ ok: true }) });
    await recovered.client.get("/recurso-teste");
    assert.equal(recovered.calls.length, 2);
    const persistent = setup(t, { api: async () => new Response("segredo-ficticio", { status }) });
    await assert.rejects(persistent.client.get("/recurso-teste"), isError("unavailable", status));
    assert.equal(persistent.calls.length, 3);
  }
});

test("POST não é repetido automaticamente mesmo em falha temporária ou 401", async (t) => {
  for (const status of [401, 429, 500, 503]) {
    const fixture = setup(t, { api: async () => new Response(null, { status }) });
    await assert.rejects(fixture.client.request("/recurso-teste", { method: "POST", body: { ficticio: true } }), MagaluHttpError);
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.refreshCalls(), 0);
  }
});

test("falha de rede tem retry limitado e ignora mensagem que contém credenciais", async (t) => {
  const fixture = setup(t, { api: async () => { throw new Error("secret-ficticio refresh-original-ficticio"); } });
  await assert.rejects(fixture.client.get("/recurso-teste"), (error: unknown) => {
    assert.ok(error instanceof MagaluHttpError);
    assert.equal(error.code, "network");
    assert.ok(!error.message.includes("secret-ficticio"));
    return true;
  });
  assert.equal(fixture.calls.length, 3);
});

test("resposta inválida e X-Request-ID impróprio não expõem informação sensível", async (t) => {
  const fixture = setup(t, { api: async () => new Response("token-ficticio", { headers: { "X-Request-ID": "telefone-ficticio" } }) });
  await assert.rejects(fixture.client.get("/recurso-teste"), (error: unknown) => {
    assert.ok(error instanceof MagaluHttpError);
    assert.equal(error.code, "invalid_response");
    assert.match(error.requestId!, /^[0-9a-f-]{36}$/);
    assert.ok(!JSON.stringify(error).includes("telefone-ficticio"));
    assert.ok(!error.message.includes("token-ficticio"));
    return true;
  });
  assert.equal(fixture.calls.length, 1);
});

test("suporta 204 e texto sem expor o objeto Response", async (t) => {
  const empty = setup(t, { api: async () => new Response(null, { status: 204 }) });
  assert.equal((await empty.client.get("/recurso-teste")).data, null);
  const text = setup(t, { api: async () => new Response("conteudo-ficticio") });
  const response = await text.client.get<string>("/recurso-teste", { responseType: "text" });
  assert.equal(response.data, "conteudo-ficticio");
  assert.deepEqual(Object.keys(response).sort(), ["data", "requestId", "status"]);
});

test("destinos externos e limites de retry indevidos são bloqueados antes de chamar API", async (t) => {
  const fixture = setup(t);
  for (const path of ["https://attacker.example", "//attacker.example", "/\\attacker.example", "/recurso#fragmento"]) {
    await assert.rejects(fixture.client.get(path), isError("bad_request"));
  }
  for (const maxRetries of [-1, 4, 1.5, Infinity]) await assert.rejects(fixture.client.get("/recurso-teste", { maxRetries }), isError("bad_request"));
  assert.equal(fixture.calls.length, 0);
  assert.equal(fixture.refreshCalls(), 0);
});

test("conta inativa ou alterada no banco e token adulterado impedem chamada", async (t) => {
  const fixture = setup(t);
  fixture.storage.account = { ...fixture.storage.account, isActive: false };
  await assert.rejects(fixture.client.get("/recurso-teste"), isError("invalid_account"));
  fixture.storage.account = { ...fixture.original, accessTokenEncrypted: "v1.adulterado" };
  await assert.rejects(fixture.client.get("/recurso-teste"), isError("token_protection"));
  assert.equal(fixture.calls.length, 0);
});

test("expiração do JWT e margem preventiva também disparam renovação", async (t) => {
  for (const expiresAt of [1, Math.floor(Date.now() / 1000) + 30]) {
    const fixture = setup(t);
    fixture.storage.account = { ...fixture.storage.account,
      accessTokenEncrypted: encryptToken(tokenFixture({ exp: expiresAt }).access_token) };
    await fixture.client.get("/recurso-teste");
    assert.equal(fixture.refreshCalls(), 1);
  }
});

test("refresh de outra conta ou resposta inválida não altera as credenciais", async (t) => {
  for (const tokens of [tokenFixture({ sub: "tenant-diferente" }), { ...tokenFixture(), refresh_token: "" }]) {
    const fixture = setup(t, { expired: true, oauth: async () => Response.json(tokens) });
    await assert.rejects(fixture.client.get("/recurso-teste"), isError("invalid_response"));
    assert.equal(fixture.storage.writes.length, 0);
    assert.equal(fixture.storage.account.refreshTokenEncrypted, fixture.original.refreshTokenEncrypted);
  }
});

test("falha de rede durante refresh não é repetida automaticamente", async (t) => {
  const fixture = setup(t, { expired: true, oauth: async () => { throw new Error("secret-ficticio"); } });
  await assert.rejects(fixture.client.get("/recurso-teste"), isError("network"));
  assert.equal(fixture.refreshCalls(), 1);
  assert.equal(fixture.storage.writes.length, 0);
  assert.equal(fixture.calls.length, 0);
});

test("pausa longa de 503 preserva o erro 503 e request ID", async (t) => {
  const fixture = setup(t, { api: async () => new Response(null, { status: 503,
    headers: { "Retry-After": "120", "X-Request-ID": traceId } }) });
  await assert.rejects(fixture.client.get("/recurso-teste"), (error: unknown) => {
    assert.ok(error instanceof MagaluHttpError);
    assert.equal(error.code, "unavailable");
    assert.equal(error.providerStatus, 503);
    assert.equal(error.requestId, traceId);
    assert.equal(error.retryAfterMs, 120_000);
    return true;
  });
  assert.equal(fixture.calls.length, 1);
});

test("maxRetries=0 desabilita repetição de erros temporários", async (t) => {
  const fixture = setup(t, { api: async () => new Response(null, { status: 503 }) });
  await assert.rejects(fixture.client.get("/recurso-teste", { maxRetries: 0 }), isError("unavailable", 503));
  assert.equal(fixture.calls.length, 1);
});

test("cancelamento do chamador impede consultas sem expor razão externa", async (t) => {
  const fixture = setup(t);
  const controller = new AbortController();
  controller.abort("secret-ficticio");
  await assert.rejects(fixture.client.get("/recurso-teste", { signal: controller.signal }), isError("cancelled"));
  assert.equal(fixture.calls.length, 0);
  assert.equal(fixture.refreshCalls(), 0);
});
