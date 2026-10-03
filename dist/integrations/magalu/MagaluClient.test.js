"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const node_test_1 = require("node:test");
const tokenEncryption_1 = require("../../utils/tokenEncryption");
const MagaluClient_1 = require("./MagaluClient");
const MagaluTokenService_1 = require("./MagaluTokenService");
const magaluOAuthClient_1 = require("./magaluOAuthClient");
const MagaluRequestLimiter_1 = require("./MagaluRequestLimiter");
const magaluHttpError_1 = require("./magaluHttpError");
const magaluConfig_1 = require("./magaluConfig");
const magaluOAuthTestSupport_1 = require("./magaluOAuthTestSupport");
const traceId = "11111111-1111-4111-8111-111111111111";
class MemoryTokenStorage {
    account;
    commitFailures = 0;
    writes = [];
    queue = Promise.resolve();
    constructor(account) {
        this.account = account;
    }
    async findAccount() { return { ...this.account }; }
    async withLockedAccount(_id, work) {
        const turn = this.queue.then(async () => {
            const original = { ...this.account };
            let next;
            const result = await work(original, async (tokens) => { this.writes.push(tokens); next = tokens; });
            if (this.commitFailures > 0) {
                this.commitFailures--;
                throw new Error("erro banco com dados sensíveis-ficticios");
            }
            if (next)
                this.account = { ...this.account, ...next };
            return result;
        });
        this.queue = turn.then(() => { }, () => { });
        return turn;
    }
}
function setup(t, options = {}) {
    const previousKey = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = (0, node_crypto_1.randomBytes)(32).toString("base64");
    t.after(() => { if (previousKey === undefined)
        delete process.env.TOKEN_ENCRYPTION_KEY;
    else
        process.env.TOKEN_ENCRYPTION_KEY = previousKey; });
    const audience = options.production ? "https://api.magalu.com" : "https://api-sandbox.magalu.com";
    const originalToken = (0, magaluOAuthTestSupport_1.tokenFixture)({ jti: "original", aud: audience }).access_token;
    const refreshed = (0, magaluOAuthTestSupport_1.tokenFixture)({ jti: "renovado", aud: audience });
    const original = {
        id: "00000000-0000-4000-8000-000000000004", platform: "MAGALU", externalAccountId: magaluOAuthTestSupport_1.tenantId,
        userId: magaluOAuthTestSupport_1.testUserId, isActive: true, accessTokenEncrypted: (0, tokenEncryption_1.encryptToken)(originalToken),
        refreshTokenEncrypted: (0, tokenEncryption_1.encryptToken)("refresh-original-ficticio"),
        tokenExpiresAt: new Date(Date.now() + (options.expired ? -1000 : 7200_000)),
    };
    const storage = new MemoryTokenStorage(original);
    let clock = Date.now();
    const now = () => clock;
    const delays = [];
    const limiter = new MagaluRequestLimiter_1.MagaluRequestLimiter({ nowFn: now, sleepFn: async (ms) => {
            delays.push(ms);
            await new Promise((resolve) => setImmediate(resolve));
            clock += ms;
        } });
    const config = { ...magaluOAuthTestSupport_1.oauthTestConfig, audience, environment: options.production ? "production" : "sandbox" };
    let refreshCalls = 0;
    const oauth = new magaluOAuthClient_1.MagaluOAuthClient(async (input, init) => {
        refreshCalls++;
        return options.oauth ? options.oauth(input, init) : Response.json(refreshed);
    });
    const tokens = new MagaluTokenService_1.MagaluTokenService(oauth, storage, now);
    const calls = [];
    const api = async (input, init) => {
        calls.push({ url: String(input), init, at: now() });
        return options.api ? options.api(input, init) : Response.json({ ok: true }, { headers: { "X-Request-ID": traceId } });
    };
    const dependencies = {
        fetchFn: api, tokenService: tokens, limiter, nowFn: now,
        getConfig: () => (0, magaluConfig_1.getMagaluConfig)({ ...magaluOAuthTestSupport_1.oauthTestEnv, MAGALU_ENV: config.environment }),
        getOAuthConfig: () => config,
    };
    return { client: new MagaluClient_1.MagaluClient(original, dependencies), newClient: () => new MagaluClient_1.MagaluClient(original, dependencies),
        original, originalToken, refreshed, storage, tokens, config, calls, delays, now, refreshCalls: () => refreshCalls };
}
function isError(code, status) {
    return (error) => error instanceof magaluHttpError_1.MagaluHttpError && error.code === code && (status === undefined || error.providerStatus === status);
}
(0, node_test_1.test)("token válido usa Bearer, base sandbox e X-Request-ID sem refresh", async (t) => {
    const fixture = setup(t);
    const response = await fixture.client.get("/recurso-teste", { query: { page: 2, active: true }, headers: { Authorization: "indevido", Cookie: "segredo" } });
    strict_1.default.equal(fixture.calls[0]?.url, "https://api-sandbox.magalu.com/recurso-teste?page=2&active=true");
    const headers = new Headers(fixture.calls[0]?.init?.headers);
    strict_1.default.equal(headers.get("authorization"), `Bearer ${fixture.originalToken}`);
    strict_1.default.match(headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
    strict_1.default.equal(headers.get("cookie"), null);
    strict_1.default.equal(fixture.calls[0]?.init?.redirect, "error");
    strict_1.default.ok(fixture.calls[0]?.init?.signal);
    strict_1.default.deepEqual(response, { data: { ok: true }, status: 200, requestId: traceId });
    strict_1.default.equal(fixture.refreshCalls(), 0);
});
(0, node_test_1.test)("produção usa somente base oficial de produção", async (t) => {
    const { client, calls } = setup(t, { production: true });
    await client.get("/recurso-teste");
    strict_1.default.equal(calls[0]?.url, "https://api.magalu.com/recurso-teste");
});
(0, node_test_1.test)("token expirado renova pelo formulário oficial e salva os dois tokens antes da chamada", async (t) => {
    const refreshed = (0, magaluOAuthTestSupport_1.tokenFixture)({ jti: "novo" });
    const fixture = setup(t, { expired: true, oauth: async (input, init) => {
            strict_1.default.equal(input, "https://id.magalu.com/oauth/token");
            strict_1.default.equal(init?.method, "POST");
            strict_1.default.equal(new Headers(init?.headers).get("content-type"), "application/x-www-form-urlencoded");
            strict_1.default.ok(init?.body instanceof URLSearchParams);
            strict_1.default.deepEqual(Object.fromEntries(init.body), { grant_type: "refresh_token", client_id: magaluOAuthTestSupport_1.oauthTestConfig.clientId,
                client_secret: magaluOAuthTestSupport_1.oauthTestConfig.clientSecret, refresh_token: "refresh-original-ficticio" });
            strict_1.default.equal(init.redirect, "error");
            return Response.json(refreshed);
        }, api: async (_input, init) => {
            strict_1.default.equal((0, tokenEncryption_1.decryptToken)(fixture.storage.account.accessTokenEncrypted), refreshed.access_token);
            strict_1.default.equal((0, tokenEncryption_1.decryptToken)(fixture.storage.account.refreshTokenEncrypted), refreshed.refresh_token);
            strict_1.default.equal(new Headers(init?.headers).get("authorization"), `Bearer ${refreshed.access_token}`);
            return Response.json({ ok: true });
        } });
    await fixture.client.get("/recurso-teste");
    strict_1.default.equal(fixture.refreshCalls(), 1);
    strict_1.default.equal(fixture.storage.writes.length, 1);
    strict_1.default.match(fixture.storage.account.refreshTokenEncrypted, /^v1\./);
    strict_1.default.ok(fixture.storage.account.tokenExpiresAt.getTime() > Date.now() + 7190_000);
});
(0, node_test_1.test)("refresh sem novo refresh_token mantém exatamente o refresh criptografado existente", async (t) => {
    const { refresh_token: _unused, ...tokens } = (0, magaluOAuthTestSupport_1.tokenFixture)({ jti: "novo" });
    const fixture = setup(t, { expired: true, oauth: async () => Response.json(tokens) });
    const previous = fixture.original.refreshTokenEncrypted;
    await fixture.client.get("/recurso-teste");
    strict_1.default.equal(fixture.storage.account.refreshTokenEncrypted, previous);
    strict_1.default.equal((0, tokenEncryption_1.decryptToken)(previous), "refresh-original-ficticio");
});
(0, node_test_1.test)("falha de refresh preserva tokens antigos, request ID e não chama API", async (t) => {
    for (const status of [400, 401, 403, 429, 500, 503]) {
        const fixture = setup(t, { expired: true, oauth: async () => Response.json({ secret: "dado-sensível-ficticio" }, { status, headers: { "X-Request-ID": traceId } }) });
        await strict_1.default.rejects(fixture.client.get("/recurso-teste"), (error) => {
            strict_1.default.ok(error instanceof magaluHttpError_1.MagaluHttpError);
            strict_1.default.equal(error.providerStatus, status);
            strict_1.default.equal(error.requestId, traceId);
            strict_1.default.ok(!JSON.stringify(error).includes("dado-sensível"));
            return true;
        });
        strict_1.default.equal(fixture.storage.account.accessTokenEncrypted, fixture.original.accessTokenEncrypted);
        strict_1.default.equal(fixture.storage.account.refreshTokenEncrypted, fixture.original.refreshTokenEncrypted);
        strict_1.default.equal(fixture.storage.writes.length, 0);
        strict_1.default.equal(fixture.refreshCalls(), 1);
        strict_1.default.equal(fixture.calls.length, 0);
    }
});
(0, node_test_1.test)("falha de COMMIT mantém banco intacto e recupera novo refresh sem repetir a renovação", async (t) => {
    const fixture = setup(t, { expired: true });
    fixture.storage.commitFailures = 1;
    await strict_1.default.rejects(fixture.client.get("/recurso-teste"), isError("token_persistence"));
    strict_1.default.equal(fixture.storage.account.refreshTokenEncrypted, fixture.original.refreshTokenEncrypted);
    strict_1.default.equal(fixture.calls.length, 0);
    strict_1.default.equal(fixture.refreshCalls(), 1);
    await fixture.newClient().get("/recurso-teste");
    strict_1.default.equal(fixture.refreshCalls(), 1);
    strict_1.default.equal((0, tokenEncryption_1.decryptToken)(fixture.storage.account.refreshTokenEncrypted), fixture.refreshed.refresh_token);
    strict_1.default.equal(fixture.calls.length, 1);
});
(0, node_test_1.test)("clients concorrentes compartilham uma renovação e mantêm chamadas espaçadas", async (t) => {
    const fixture = setup(t, { expired: true });
    await Promise.all([fixture.client.get("/recurso-teste"), fixture.newClient().get("/recurso-teste")]);
    strict_1.default.equal(fixture.refreshCalls(), 1);
    strict_1.default.equal(fixture.storage.writes.length, 1);
    strict_1.default.equal(fixture.calls.length, 2);
    strict_1.default.ok(fixture.calls[1].at - fixture.calls[0].at >= 250);
});
(0, node_test_1.test)("401 renova uma vez e repete leitura com o novo token", async (t) => {
    let count = 0;
    const fixture = setup(t, { api: async () => ++count === 1 ? new Response("sensível-ficticio", { status: 401 }) : Response.json({ ok: true }) });
    await fixture.client.get("/recurso-teste");
    strict_1.default.equal(fixture.calls.length, 2);
    strict_1.default.equal(fixture.refreshCalls(), 1);
    strict_1.default.equal(new Headers(fixture.calls[1]?.init?.headers).get("authorization"), `Bearer ${fixture.refreshed.access_token}`);
});
(0, node_test_1.test)("401 persistente encerra após uma renovação", async (t) => {
    const fixture = setup(t, { api: async () => new Response("sensível-ficticio", { status: 401 }) });
    await strict_1.default.rejects(fixture.client.get("/recurso-teste"), isError("unauthorized", 401));
    strict_1.default.equal(fixture.calls.length, 2);
    strict_1.default.equal(fixture.refreshCalls(), 1);
});
(0, node_test_1.test)("400, 403 e 404 retornam erros compreensíveis sem retry ou body externo", async (t) => {
    for (const [status, code] of [[400, "bad_request"], [403, "forbidden"], [404, "not_found"]]) {
        const fixture = setup(t, { api: async () => Response.json({ phone: "telefone-ficticio", access_token: "token-ficticio" }, { status, headers: { "X-Request-ID": traceId } }) });
        await strict_1.default.rejects(fixture.client.get("/recurso-teste"), (error) => {
            strict_1.default.ok(error instanceof magaluHttpError_1.MagaluHttpError);
            strict_1.default.equal(error.code, code);
            strict_1.default.equal(error.requestId, traceId);
            strict_1.default.ok(!JSON.stringify(error).includes("telefone-ficticio"));
            strict_1.default.ok(!JSON.stringify(error).includes("token-ficticio"));
            return true;
        });
        strict_1.default.equal(fixture.calls.length, 1);
        strict_1.default.equal(fixture.refreshCalls(), 0);
    }
});
(0, node_test_1.test)("429 respeita Retry-After em segundos e HTTP-date", async (t) => {
    for (const retryAfter of ["2", new Date(Date.now() + 4000).toUTCString()]) {
        let count = 0;
        const fixture = setup(t, { api: async () => ++count === 1
                ? new Response("sensível-ficticio", { status: 429, headers: { "Retry-After": retryAfter, "X-Request-ID": traceId } })
                : Response.json({ ok: true }) });
        await fixture.client.get("/recurso-teste");
        const expectedDelay = retryAfter === "2" ? 2000 : Date.parse(retryAfter) - fixture.calls[0].at;
        strict_1.default.ok(fixture.calls[1].at - fixture.calls[0].at >= expectedDelay);
        strict_1.default.equal(fixture.calls.length, 2);
    }
});
(0, node_test_1.test)("429 com pausa longa encerra sem antecipar chamada e bloqueia outros clients", async (t) => {
    const fixture = setup(t, { api: async () => new Response(null, { status: 429, headers: { "Retry-After": "120", "X-Request-ID": traceId } }) });
    await strict_1.default.rejects(fixture.client.get("/recurso-teste"), (error) => {
        strict_1.default.ok(error instanceof magaluHttpError_1.MagaluHttpError);
        strict_1.default.equal(error.code, "rate_limited");
        strict_1.default.equal(error.retryAfterMs, 120_000);
        strict_1.default.equal(error.requestId, traceId);
        return true;
    });
    await strict_1.default.rejects(fixture.newClient().get("/recurso-teste"), isError("rate_limited"));
    strict_1.default.equal(fixture.calls.length, 1);
});
(0, node_test_1.test)("500/503 temporários se recuperam; persistentes param após três chamadas", async (t) => {
    for (const status of [500, 503]) {
        let count = 0;
        const recovered = setup(t, { api: async () => ++count === 1 ? new Response(null, { status }) : Response.json({ ok: true }) });
        await recovered.client.get("/recurso-teste");
        strict_1.default.equal(recovered.calls.length, 2);
        const persistent = setup(t, { api: async () => new Response("segredo-ficticio", { status }) });
        await strict_1.default.rejects(persistent.client.get("/recurso-teste"), isError("unavailable", status));
        strict_1.default.equal(persistent.calls.length, 3);
    }
});
(0, node_test_1.test)("POST não é repetido automaticamente mesmo em falha temporária ou 401", async (t) => {
    for (const status of [401, 429, 500, 503]) {
        const fixture = setup(t, { api: async () => new Response(null, { status }) });
        await strict_1.default.rejects(fixture.client.request("/recurso-teste", { method: "POST", body: { ficticio: true } }), magaluHttpError_1.MagaluHttpError);
        strict_1.default.equal(fixture.calls.length, 1);
        strict_1.default.equal(fixture.refreshCalls(), 0);
    }
});
(0, node_test_1.test)("falha de rede tem retry limitado e ignora mensagem que contém credenciais", async (t) => {
    const fixture = setup(t, { api: async () => { throw new Error("secret-ficticio refresh-original-ficticio"); } });
    await strict_1.default.rejects(fixture.client.get("/recurso-teste"), (error) => {
        strict_1.default.ok(error instanceof magaluHttpError_1.MagaluHttpError);
        strict_1.default.equal(error.code, "network");
        strict_1.default.ok(!error.message.includes("secret-ficticio"));
        return true;
    });
    strict_1.default.equal(fixture.calls.length, 3);
});
(0, node_test_1.test)("resposta inválida e X-Request-ID impróprio não expõem informação sensível", async (t) => {
    const fixture = setup(t, { api: async () => new Response("token-ficticio", { headers: { "X-Request-ID": "telefone-ficticio" } }) });
    await strict_1.default.rejects(fixture.client.get("/recurso-teste"), (error) => {
        strict_1.default.ok(error instanceof magaluHttpError_1.MagaluHttpError);
        strict_1.default.equal(error.code, "invalid_response");
        strict_1.default.match(error.requestId, /^[0-9a-f-]{36}$/);
        strict_1.default.ok(!JSON.stringify(error).includes("telefone-ficticio"));
        strict_1.default.ok(!error.message.includes("token-ficticio"));
        return true;
    });
    strict_1.default.equal(fixture.calls.length, 1);
});
(0, node_test_1.test)("suporta 204 e texto sem expor o objeto Response", async (t) => {
    const empty = setup(t, { api: async () => new Response(null, { status: 204 }) });
    strict_1.default.equal((await empty.client.get("/recurso-teste")).data, null);
    const text = setup(t, { api: async () => new Response("conteudo-ficticio") });
    const response = await text.client.get("/recurso-teste", { responseType: "text" });
    strict_1.default.equal(response.data, "conteudo-ficticio");
    strict_1.default.deepEqual(Object.keys(response).sort(), ["data", "requestId", "status"]);
});
(0, node_test_1.test)("destinos externos e limites de retry indevidos são bloqueados antes de chamar API", async (t) => {
    const fixture = setup(t);
    for (const path of ["https://attacker.example", "//attacker.example", "/\\attacker.example", "/recurso#fragmento"]) {
        await strict_1.default.rejects(fixture.client.get(path), isError("bad_request"));
    }
    for (const maxRetries of [-1, 4, 1.5, Infinity])
        await strict_1.default.rejects(fixture.client.get("/recurso-teste", { maxRetries }), isError("bad_request"));
    strict_1.default.equal(fixture.calls.length, 0);
    strict_1.default.equal(fixture.refreshCalls(), 0);
});
(0, node_test_1.test)("conta inativa ou alterada no banco e token adulterado impedem chamada", async (t) => {
    const fixture = setup(t);
    fixture.storage.account = { ...fixture.storage.account, isActive: false };
    await strict_1.default.rejects(fixture.client.get("/recurso-teste"), isError("invalid_account"));
    fixture.storage.account = { ...fixture.original, accessTokenEncrypted: "v1.adulterado" };
    await strict_1.default.rejects(fixture.client.get("/recurso-teste"), isError("token_protection"));
    strict_1.default.equal(fixture.calls.length, 0);
});
(0, node_test_1.test)("expiração do JWT e margem preventiva também disparam renovação", async (t) => {
    for (const expiresAt of [1, Math.floor(Date.now() / 1000) + 30]) {
        const fixture = setup(t);
        fixture.storage.account = { ...fixture.storage.account,
            accessTokenEncrypted: (0, tokenEncryption_1.encryptToken)((0, magaluOAuthTestSupport_1.tokenFixture)({ exp: expiresAt }).access_token) };
        await fixture.client.get("/recurso-teste");
        strict_1.default.equal(fixture.refreshCalls(), 1);
    }
});
(0, node_test_1.test)("refresh de outra conta ou resposta inválida não altera as credenciais", async (t) => {
    for (const tokens of [(0, magaluOAuthTestSupport_1.tokenFixture)({ sub: "tenant-diferente" }), { ...(0, magaluOAuthTestSupport_1.tokenFixture)(), refresh_token: "" }]) {
        const fixture = setup(t, { expired: true, oauth: async () => Response.json(tokens) });
        await strict_1.default.rejects(fixture.client.get("/recurso-teste"), isError("invalid_response"));
        strict_1.default.equal(fixture.storage.writes.length, 0);
        strict_1.default.equal(fixture.storage.account.refreshTokenEncrypted, fixture.original.refreshTokenEncrypted);
    }
});
(0, node_test_1.test)("falha de rede durante refresh não é repetida automaticamente", async (t) => {
    const fixture = setup(t, { expired: true, oauth: async () => { throw new Error("secret-ficticio"); } });
    await strict_1.default.rejects(fixture.client.get("/recurso-teste"), isError("network"));
    strict_1.default.equal(fixture.refreshCalls(), 1);
    strict_1.default.equal(fixture.storage.writes.length, 0);
    strict_1.default.equal(fixture.calls.length, 0);
});
(0, node_test_1.test)("pausa longa de 503 preserva o erro 503 e request ID", async (t) => {
    const fixture = setup(t, { api: async () => new Response(null, { status: 503,
            headers: { "Retry-After": "120", "X-Request-ID": traceId } }) });
    await strict_1.default.rejects(fixture.client.get("/recurso-teste"), (error) => {
        strict_1.default.ok(error instanceof magaluHttpError_1.MagaluHttpError);
        strict_1.default.equal(error.code, "unavailable");
        strict_1.default.equal(error.providerStatus, 503);
        strict_1.default.equal(error.requestId, traceId);
        strict_1.default.equal(error.retryAfterMs, 120_000);
        return true;
    });
    strict_1.default.equal(fixture.calls.length, 1);
});
(0, node_test_1.test)("maxRetries=0 desabilita repetição de erros temporários", async (t) => {
    const fixture = setup(t, { api: async () => new Response(null, { status: 503 }) });
    await strict_1.default.rejects(fixture.client.get("/recurso-teste", { maxRetries: 0 }), isError("unavailable", 503));
    strict_1.default.equal(fixture.calls.length, 1);
});
(0, node_test_1.test)("cancelamento do chamador impede consultas sem expor razão externa", async (t) => {
    const fixture = setup(t);
    const controller = new AbortController();
    controller.abort("secret-ficticio");
    await strict_1.default.rejects(fixture.client.get("/recurso-teste", { signal: controller.signal }), isError("cancelled"));
    strict_1.default.equal(fixture.calls.length, 0);
    strict_1.default.equal(fixture.refreshCalls(), 0);
});
//# sourceMappingURL=MagaluClient.test.js.map