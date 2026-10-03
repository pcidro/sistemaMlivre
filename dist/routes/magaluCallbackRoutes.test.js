"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const node_http_1 = require("node:http");
const node_test_1 = require("node:test");
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = require("jsonwebtoken");
const magaluCallbackController_1 = require("../controllers/marketplaceAccounts/magaluCallbackController");
const MagaluOAuthService_1 = require("../integrations/magalu/MagaluOAuthService");
const magaluOAuthClient_1 = require("../integrations/magalu/magaluOAuthClient");
const magaluOAuthTestSupport_1 = require("../integrations/magalu/magaluOAuthTestSupport");
const errorHandler_1 = require("../middlewares/errorHandler");
const magaluCallbackRoutes_1 = require("./magaluCallbackRoutes");
async function withApi(work, tokenError = false) {
    const previous = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET, TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY };
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "jwt-secret-ficticio";
    process.env.TOKEN_ENCRYPTION_KEY = (0, node_crypto_1.randomBytes)(32).toString("base64");
    const app = (0, express_1.default)();
    const storage = new magaluOAuthTestSupport_1.MemoryMagaluStorage();
    let requests = 0;
    const client = new magaluOAuthClient_1.MagaluOAuthClient(async () => {
        requests++;
        return tokenError ? new Response("secret-ficticio access_token refresh_token", { status: 400 }) : Response.json((0, magaluOAuthTestSupport_1.tokenFixture)());
    });
    const service = new MagaluOAuthService_1.MagaluOAuthService(client, storage, () => magaluOAuthTestSupport_1.oauthTestConfig);
    app.use("/api/marketplace-accounts/magalu", (0, magaluCallbackRoutes_1.createMagaluCallbackRoutes)(new magaluCallbackController_1.MagaluCallbackController(service)));
    app.use(errorHandler_1.errorHandler);
    const server = (0, node_http_1.createServer)(app);
    try {
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const port = server.address().port;
        await work(`http://127.0.0.1:${port}/api/marketplace-accounts/magalu`, storage, () => requests);
    }
    finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(() => resolve()));
        for (const [name, value] of Object.entries(previous)) {
            if (value === undefined)
                delete process.env[name];
            else
                process.env[name] = value;
        }
    }
}
async function connect(url) {
    const token = (0, jsonwebtoken_1.sign)({}, process.env.JWT_SECRET, { subject: magaluOAuthTestSupport_1.testUserId, expiresIn: "5m" });
    const response = await fetch(`${url}/connect`, { redirect: "manual", headers: { Cookie: `auth_token=${token}` } });
    strict_1.default.equal(response.status, 302);
    const location = new URL(response.headers.get("location"));
    const cookie = response.headers.get("set-cookie").split(";")[0];
    return { response, location, cookie, state: location.searchParams.get("state") };
}
(0, node_test_1.test)("connect exige usuário autenticado e envia cookie HttpOnly Secure SameSite=Lax", async () => {
    await withApi(async (url, storage) => {
        const unauthenticated = await fetch(`${url}/connect`, { redirect: "manual" });
        strict_1.default.equal(unauthenticated.status, 401);
        strict_1.default.equal(unauthenticated.headers.get("location"), null);
        strict_1.default.equal(storage.states.size, 0);
        const { response, location, cookie } = await connect(url);
        strict_1.default.equal(location.origin + location.pathname, "https://id.magalu.com/login");
        strict_1.default.equal(location.searchParams.get("choose_tenants"), "true");
        const header = response.headers.get("set-cookie");
        for (const pattern of [/HttpOnly/, /Secure/, /SameSite=Lax/, /Max-Age=600/, /Path=\/api\/marketplace-accounts\/magalu\/callback/])
            strict_1.default.match(header, pattern);
        strict_1.default.match(cookie, /^magalu_oauth_state=[a-f0-9]{64}$/);
        strict_1.default.ok(!header.includes(magaluOAuthTestSupport_1.testUserId));
        strict_1.default.equal(response.headers.get("cache-control"), "private, no-store");
    });
});
(0, node_test_1.test)("callback com state válido conecta sem enviar tokens, key, code ou secret na resposta", async () => {
    await withApi(async (url, storage, requests) => {
        const { state, cookie } = await connect(url);
        const callback = `${url}/callback?code=code-ficticio&state=${state}`;
        const response = await fetch(callback, { headers: { Cookie: cookie, Accept: "application/json" } });
        strict_1.default.equal(response.status, 200);
        const body = await response.text();
        strict_1.default.deepEqual(JSON.parse(body), { status: "connected", message: "Conta Magalu conectada com sucesso." });
        for (const sensitive of ["code-ficticio", state, "refresh-ficticio", "secret-ficticio", process.env.TOKEN_ENCRYPTION_KEY, (0, magaluOAuthTestSupport_1.tokenFixture)().access_token])
            strict_1.default.ok(!body.includes(sensitive));
        strict_1.default.match(response.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
        strict_1.default.equal(storage.accounts.get(magaluOAuthTestSupport_1.tenantId)?.userId, magaluOAuthTestSupport_1.testUserId);
        strict_1.default.equal(requests(), 1);
        const replay = await fetch(callback, { headers: { Cookie: cookie } });
        strict_1.default.equal(replay.status, 400);
        strict_1.default.equal(requests(), 1);
    });
});
(0, node_test_1.test)("callback sem state/cookie ou com state inválido não troca code", async () => {
    await withApi(async (url, _storage, requests) => {
        const { state, cookie } = await connect(url);
        for (const [query, receivedCookie] of [
            [`code=code-ficticio&state=${state}`, ""],
            [`code=code-ficticio&state=${"a".repeat(64)}`, cookie],
            [`code=code-ficticio&state=${state}`, "magalu_oauth_state=%ZZ"],
            [`code=code-ficticio&state=${state}`, `${cookie}; ${cookie}`],
        ]) {
            const response = await fetch(`${url}/callback?${query}`, { headers: { Cookie: receivedCookie } });
            strict_1.default.equal(response.status, 400);
        }
        strict_1.default.equal(requests(), 0);
    });
});
(0, node_test_1.test)("callback sem code e parâmetros repetidos, inesperados ou incompatíveis são recusados", async () => {
    await withApi(async (url, _storage, requests) => {
        const { state, cookie } = await connect(url);
        const queries = ["", `state=${state}`, "code=code", `code=&state=${state}`,
            `code=um&code=dois&state=${state}`, `code=code&state=${state}&state=${state}`,
            `code=code&state=${state}&error=access_denied`, `code=code&state=${state}&redirect_uri=https://example.com`,
            "code=code&state=%0A", "code=code&state=" + "a".repeat(2049)];
        for (const query of queries) {
            const response = await fetch(`${url}/callback?${query}`, { headers: { Cookie: cookie, Accept: "application/json" } });
            strict_1.default.equal(response.status, 400);
            strict_1.default.equal((await response.json()).status, "not_connected");
        }
        strict_1.default.equal(requests(), 0);
    });
});
(0, node_test_1.test)("recusa de consentimento não reflete mensagem/URL externa e invalida state", async () => {
    await withApi(async (url, storage, requests) => {
        const { state, cookie } = await connect(url);
        const query = new URLSearchParams({ error: "access_denied", state,
            error_description: '<script>alert("secret-ficticio")</script>', error_uri: "https://example.com/secret-ficticio" });
        const response = await fetch(`${url}/callback?${query}`, { headers: { Cookie: cookie } });
        strict_1.default.equal(response.status, 400);
        const body = await response.text();
        strict_1.default.ok(!body.includes("<script>"));
        strict_1.default.ok(!body.includes("secret-ficticio"));
        strict_1.default.ok(!body.includes(state));
        strict_1.default.equal(response.headers.get("location"), null);
        strict_1.default.equal(storage.states.size, 0);
        strict_1.default.equal(requests(), 0);
    });
});
(0, node_test_1.test)("falha na troca do code retorna erro seguro e não cria conta", async () => {
    await withApi(async (url, storage, requests) => {
        const { state, cookie } = await connect(url);
        const response = await fetch(`${url}/callback?code=code-ficticio&state=${state}`, { headers: { Cookie: cookie } });
        strict_1.default.equal(response.status, 502);
        strict_1.default.ok(!(await response.text()).includes("secret-ficticio"));
        strict_1.default.equal(storage.accounts.size, 0);
        strict_1.default.equal(storage.states.size, 0);
        strict_1.default.equal(requests(), 1);
    }, true);
});
(0, node_test_1.test)("respostas protegem callback com no-store, no-referrer, CSP e bloqueio de frames", async () => {
    await withApi(async (url) => {
        const response = await fetch(`${url}/callback?code=code&state=ficticio`);
        strict_1.default.equal(response.status, 400);
        strict_1.default.equal(response.headers.get("cache-control"), "private, no-store");
        strict_1.default.equal(response.headers.get("referrer-policy"), "no-referrer");
        strict_1.default.equal(response.headers.get("x-content-type-options"), "nosniff");
        strict_1.default.equal(response.headers.get("x-frame-options"), "DENY");
        strict_1.default.match(response.headers.get("content-security-policy"), /default-src 'none'/);
        strict_1.default.match(response.headers.get("x-robots-tag"), /noindex/);
    });
});
(0, node_test_1.test)("URL longa, POST e HEAD são recusados sem consumir autorização", async () => {
    await withApi(async (url, storage, requests) => {
        const { state, cookie } = await connect(url);
        const oversized = await fetch(`${url}/callback?code=${"a".repeat(8300)}&state=${state}`);
        strict_1.default.equal(oversized.status, 414);
        for (const path of ["connect", "callback"]) {
            for (const method of ["POST", "HEAD"]) {
                const response = await fetch(`${url}/${path}?code=code&state=${state}`, { method, headers: { Cookie: cookie } });
                strict_1.default.equal(response.status, 405);
                strict_1.default.equal(response.headers.get("allow"), "GET");
            }
        }
        strict_1.default.equal(storage.states.size, 1);
        strict_1.default.equal(requests(), 0);
    });
});
(0, node_test_1.test)("rate limit não expõe a query na resposta 429", async () => {
    await withApi(async (url) => {
        for (let index = 0; index < 30; index++) {
            const response = await fetch(`${url}/callback`);
            strict_1.default.equal(response.status, 400);
            await response.text();
        }
        const response = await fetch(`${url}/callback?code=secret-ficticio&state=ficticio`);
        strict_1.default.equal(response.status, 429);
        strict_1.default.ok(response.headers.get("retry-after"));
        strict_1.default.equal(response.headers.get("cache-control"), "private, no-store");
        strict_1.default.ok(!(await response.text()).includes("secret-ficticio"));
    });
});
//# sourceMappingURL=magaluCallbackRoutes.test.js.map