"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const node_test_1 = require("node:test");
const AppError_1 = require("../../errors/AppError");
const tokenEncryption_1 = require("../../utils/tokenEncryption");
const MagaluOAuthService_1 = require("./MagaluOAuthService");
const magaluOAuthClient_1 = require("./magaluOAuthClient");
const magaluOAuthConfig_1 = require("./magaluOAuthConfig");
const magaluOAuthTestSupport_1 = require("./magaluOAuthTestSupport");
function setup(fetchFn = async () => Response.json((0, magaluOAuthTestSupport_1.tokenFixture)())) {
    const storage = new magaluOAuthTestSupport_1.MemoryMagaluStorage();
    const service = new MagaluOAuthService_1.MagaluOAuthService(new magaluOAuthClient_1.MagaluOAuthClient(fetchFn), storage, () => magaluOAuthTestSupport_1.oauthTestConfig);
    return { service, storage };
}
(0, node_test_1.test)("consentimento oficial solicita apenas leitura, code e seleção de tenant", async () => {
    const { service, storage } = setup();
    const session = await service.createAuthorization(magaluOAuthTestSupport_1.testUserId);
    const url = new URL(session.authorizationUrl);
    strict_1.default.equal(url.origin + url.pathname, "https://id.magalu.com/login");
    strict_1.default.equal(url.searchParams.get("response_type"), "code");
    strict_1.default.equal(url.searchParams.get("choose_tenants"), "true");
    strict_1.default.equal(url.searchParams.get("scope"), magaluOAuthConfig_1.MAGALU_OAUTH_SCOPES.join(" "));
    strict_1.default.equal(url.searchParams.get("redirect_uri"), magaluOAuthTestSupport_1.oauthTestConfig.redirectUri);
    strict_1.default.match(session.stateCookieValue, /^[a-f0-9]{64}$/);
    strict_1.default.equal(url.searchParams.get("state"), session.stateCookieValue);
    strict_1.default.equal(storage.findState(session.stateCookieValue)?.userId, magaluOAuthTestSupport_1.testUserId);
    strict_1.default.equal(storage.states.has(session.stateCookieValue), false);
    strict_1.default.ok(!session.authorizationUrl.includes(magaluOAuthTestSupport_1.oauthTestConfig.clientSecret));
    const another = await service.createAuthorization(magaluOAuthTestSupport_1.testUserId);
    strict_1.default.notEqual(another.stateCookieValue, session.stateCookieValue);
});
(0, node_test_1.test)("state válido troca code no endpoint oficial e persiste ambos tokens criptografados", async (t) => {
    const previousKey = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = (0, node_crypto_1.randomBytes)(32).toString("base64");
    t.after(() => { if (previousKey === undefined)
        delete process.env.TOKEN_ENCRYPTION_KEY;
    else
        process.env.TOKEN_ENCRYPTION_KEY = previousKey; });
    const tokens = (0, magaluOAuthTestSupport_1.tokenFixture)();
    let requests = 0;
    const { service, storage } = setup(async (url, options) => {
        requests++;
        strict_1.default.equal(url, "https://id.magalu.com/oauth/token");
        strict_1.default.equal(options?.method, "POST");
        strict_1.default.equal(options?.redirect, "error");
        strict_1.default.ok(options?.signal);
        strict_1.default.deepEqual(options?.headers, { "Content-Type": "application/json", Accept: "application/json" });
        strict_1.default.deepEqual(JSON.parse(String(options?.body)), {
            client_id: magaluOAuthTestSupport_1.oauthTestConfig.clientId, client_secret: magaluOAuthTestSupport_1.oauthTestConfig.clientSecret,
            redirect_uri: magaluOAuthTestSupport_1.oauthTestConfig.redirectUri, code: "code-ficticio", grant_type: "authorization_code",
        });
        return Response.json(tokens);
    });
    const { stateCookieValue: state } = await service.createAuthorization(magaluOAuthTestSupport_1.testUserId);
    strict_1.default.equal(await service.completeAuthorization({ state, code: "code-ficticio" }, state), undefined);
    const account = storage.accounts.get(magaluOAuthTestSupport_1.tenantId);
    strict_1.default.equal(account.userId, magaluOAuthTestSupport_1.testUserId);
    strict_1.default.match(account.accessTokenEncrypted, /^v1\./);
    strict_1.default.match(account.refreshTokenEncrypted, /^v1\./);
    strict_1.default.notEqual(account.accessTokenEncrypted, tokens.access_token);
    strict_1.default.notEqual(account.refreshTokenEncrypted, tokens.refresh_token);
    strict_1.default.equal((0, tokenEncryption_1.decryptToken)(account.accessTokenEncrypted), tokens.access_token);
    strict_1.default.equal((0, tokenEncryption_1.decryptToken)(account.refreshTokenEncrypted), tokens.refresh_token);
    strict_1.default.ok(account.tokenExpiresAt.getTime() > Date.now() + 7_190_000);
    strict_1.default.equal(storage.states.size, 0);
    await strict_1.default.rejects(service.completeAuthorization({ state, code: "code-ficticio" }, state), /já utilizado/);
    strict_1.default.equal(requests, 1);
});
(0, node_test_1.test)("state inválido, expirado, ausente ou sem cookie não chega ao provedor", async () => {
    let requests = 0;
    const { service, storage } = setup(async () => { requests++; return Response.json((0, magaluOAuthTestSupport_1.tokenFixture)()); });
    const { stateCookieValue: state } = await service.createAuthorization(magaluOAuthTestSupport_1.testUserId);
    for (const [received, cookie] of [["invalido", state], [state, undefined], ["a".repeat(64), state], [state, "a".repeat(64)], ["b".repeat(64), "b".repeat(64)]]) {
        await strict_1.default.rejects(service.completeAuthorization({ state: received, code: "code" }, cookie), /State OAuth/);
    }
    storage.findState(state).expiresAt = new Date(Date.now() - 1);
    await strict_1.default.rejects(service.completeAuthorization({ state, code: "code" }, state), /expirado/);
    strict_1.default.equal(requests, 0);
});
(0, node_test_1.test)("state não pode ser consumido em ambiente ou client diferente", async () => {
    const { service, storage } = setup();
    const { stateCookieValue: state } = await service.createAuthorization(magaluOAuthTestSupport_1.testUserId);
    const changed = new MagaluOAuthService_1.MagaluOAuthService(new magaluOAuthClient_1.MagaluOAuthClient(), storage, () => ({ ...magaluOAuthTestSupport_1.oauthTestConfig, environment: "production" }));
    await strict_1.default.rejects(changed.completeAuthorization({ state, code: "code" }, state), /State OAuth/);
});
(0, node_test_1.test)("callback sem code ou com recusa consome state sem trocar tokens", async () => {
    let requests = 0;
    const { service, storage } = setup(async () => { requests++; throw new Error("não deve chamar"); });
    for (const error of [undefined, "access_denied"]) {
        const { stateCookieValue: state } = await service.createAuthorization(magaluOAuthTestSupport_1.testUserId);
        await strict_1.default.rejects(service.completeAuthorization(error ? { state, error } : { state }, state), /ausente|não foi concedida/);
        strict_1.default.equal(storage.findState(state), undefined);
    }
    strict_1.default.equal(requests, 0);
});
(0, node_test_1.test)("dois callbacks simultâneos só trocam um code", async () => {
    let requests = 0;
    const { service } = setup(async () => { requests++; return new Response("secret-ficticio", { status: 400 }); });
    const { stateCookieValue: state } = await service.createAuthorization(magaluOAuthTestSupport_1.testUserId);
    const results = await Promise.allSettled([
        service.completeAuthorization({ state, code: "code" }, state),
        service.completeAuthorization({ state, code: "code" }, state),
    ]);
    strict_1.default.ok(results.every((result) => result.status === "rejected"));
    strict_1.default.equal(requests, 1);
});
(0, node_test_1.test)("erro da troca e falha de rede não expõem secrets e exigem novo state", async () => {
    for (const fetchFn of [async () => new Response("secret-ficticio access_token refresh_token", { status: 400 }),
        async () => { throw new Error("secret-ficticio"); }]) {
        const { service, storage } = setup(fetchFn);
        const { stateCookieValue: state } = await service.createAuthorization(magaluOAuthTestSupport_1.testUserId);
        await strict_1.default.rejects(service.completeAuthorization({ state, code: "code" }, state), (error) => {
            strict_1.default.ok(error instanceof AppError_1.AppError);
            strict_1.default.equal(error.statusCode, 502);
            strict_1.default.ok(!error.message.includes("secret-ficticio"));
            return true;
        });
        strict_1.default.equal(storage.accounts.size, 0);
        strict_1.default.equal(storage.findState(state), undefined);
    }
});
(0, node_test_1.test)("não aceita JWT sem subject, vencido, audience divergente ou scopes insuficientes", async () => {
    const invalidResponses = [(0, magaluOAuthTestSupport_1.tokenFixture)({ sub: undefined }), (0, magaluOAuthTestSupport_1.tokenFixture)({ exp: 1 }),
        (0, magaluOAuthTestSupport_1.tokenFixture)({ aud: "https://outro.example" }), { ...(0, magaluOAuthTestSupport_1.tokenFixture)(), access_token: "invalido" },
        { ...(0, magaluOAuthTestSupport_1.tokenFixture)(), scope: magaluOAuthConfig_1.MAGALU_OAUTH_SCOPES[0] }, { ...(0, magaluOAuthTestSupport_1.tokenFixture)(), refresh_token: "" },
        { ...(0, magaluOAuthTestSupport_1.tokenFixture)(), created_at: Math.floor(Date.now() / 1000) + 3600 }];
    for (const tokens of invalidResponses) {
        const client = new magaluOAuthClient_1.MagaluOAuthClient(async () => Response.json(tokens));
        await strict_1.default.rejects(client.exchangeAuthorizationCode("code", magaluOAuthTestSupport_1.oauthTestConfig), /troca do código/);
    }
});
(0, node_test_1.test)("expiração usa o menor prazo entre expires_in e exp do JWT", async () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    const client = new magaluOAuthClient_1.MagaluOAuthClient(async () => Response.json((0, magaluOAuthTestSupport_1.tokenFixture)({ exp })));
    const result = await client.exchangeAuthorizationCode("code", magaluOAuthTestSupport_1.oauthTestConfig);
    strict_1.default.equal(result.tokenExpiresAt.getTime(), exp * 1000);
});
(0, node_test_1.test)("não salva tokens quando a chave de criptografia é inválida", async (t) => {
    const previousKey = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = "invalida";
    t.after(() => { if (previousKey === undefined)
        delete process.env.TOKEN_ENCRYPTION_KEY;
    else
        process.env.TOKEN_ENCRYPTION_KEY = previousKey; });
    const { service, storage } = setup();
    const { stateCookieValue: state } = await service.createAuthorization(magaluOAuthTestSupport_1.testUserId);
    await strict_1.default.rejects(service.completeAuthorization({ state, code: "code" }, state), /proteção dos tokens inválida/);
    strict_1.default.equal(storage.accounts.size, 0);
});
(0, node_test_1.test)("reconexão não transfere conta de outro usuário", async (t) => {
    const previousKey = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = (0, node_crypto_1.randomBytes)(32).toString("base64");
    t.after(() => { if (previousKey === undefined)
        delete process.env.TOKEN_ENCRYPTION_KEY;
    else
        process.env.TOKEN_ENCRYPTION_KEY = previousKey; });
    const { service, storage } = setup();
    const first = await service.createAuthorization(magaluOAuthTestSupport_1.testUserId);
    await service.completeAuthorization({ state: first.stateCookieValue, code: "code" }, first.stateCookieValue);
    const account = storage.accounts.get(magaluOAuthTestSupport_1.tenantId);
    const second = await service.createAuthorization(magaluOAuthTestSupport_1.otherUserId);
    await strict_1.default.rejects(service.completeAuthorization({ state: second.stateCookieValue, code: "code" }, second.stateCookieValue), (error) => error instanceof AppError_1.AppError && error.statusCode === 409);
    strict_1.default.equal(storage.accounts.get(magaluOAuthTestSupport_1.tenantId), account);
    const reconnect = await service.createAuthorization(magaluOAuthTestSupport_1.testUserId);
    await service.completeAuthorization({ state: reconnect.stateCookieValue, code: "code" }, reconnect.stateCookieValue);
    strict_1.default.equal(storage.accounts.size, 1);
});
(0, node_test_1.test)("usuário removido após connect não pode salvar uma conta", async () => {
    const { service, storage } = setup();
    const { stateCookieValue: state } = await service.createAuthorization(magaluOAuthTestSupport_1.testUserId);
    storage.users.delete(magaluOAuthTestSupport_1.testUserId);
    await strict_1.default.rejects(service.completeAuthorization({ state, code: "code" }, state), (error) => error instanceof AppError_1.AppError && error.statusCode === 401);
    strict_1.default.equal(storage.accounts.size, 0);
});
(0, node_test_1.test)("configuração bloqueia host não oficial e callback inseguro", () => {
    for (const patch of [
        { MAGALU_AUTH_URL: "https://attacker.example" }, { MAGALU_AUTH_URL: "invalid" },
        { MAGALU_AUTH_URL: "https://id.magalu.com/oauth/token" },
        { MAGALU_REDIRECT_URI: "http://example.com/api/marketplace-accounts/magalu/callback" },
        { MAGALU_REDIRECT_URI: magaluOAuthTestSupport_1.oauthTestEnv.MAGALU_REDIRECT_URI + "?code=secret-ficticio" },
        { MAGALU_CLIENT_SECRET: "" },
    ])
        strict_1.default.throws(() => (0, magaluOAuthConfig_1.getMagaluOAuthConfig)({ ...magaluOAuthTestSupport_1.oauthTestEnv, ...patch }), AppError_1.AppError);
    const local = "http://localhost:3333/api/marketplace-accounts/magalu/callback";
    const proxied = "https://mlivrefrontend.onrender.com/api/marketplace-accounts/magalu/callback";
    strict_1.default.equal((0, magaluOAuthConfig_1.getMagaluOAuthConfig)({ ...magaluOAuthTestSupport_1.oauthTestEnv, MAGALU_REDIRECT_URI: proxied }).redirectUri, proxied);
    strict_1.default.equal((0, magaluOAuthConfig_1.getMagaluOAuthConfig)({ ...magaluOAuthTestSupport_1.oauthTestEnv, MAGALU_REDIRECT_URI: local }).redirectUri, local);
    strict_1.default.throws(() => (0, magaluOAuthConfig_1.getMagaluOAuthConfig)({ ...magaluOAuthTestSupport_1.oauthTestEnv, NODE_ENV: "production", MAGALU_REDIRECT_URI: local }), AppError_1.AppError);
});
//# sourceMappingURL=magaluOAuth.test.js.map