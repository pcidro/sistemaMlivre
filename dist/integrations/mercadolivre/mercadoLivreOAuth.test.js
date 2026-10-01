"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const AppError_1 = require("../../errors/AppError");
const mercadoLivreOAuthClient_1 = require("./mercadoLivreOAuthClient");
const mercadoLivreOAuthState_1 = require("./mercadoLivreOAuthState");
const environmentKeys = [
    "JWT_SECRET",
    "MERCADO_LIVRE_CLIENT_ID",
    "MERCADO_LIVRE_CLIENT_SECRET",
    "MERCADO_LIVRE_REDIRECT_URI",
];
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
(0, node_test_1.beforeEach)(() => {
    process.env.JWT_SECRET = "jwt-secret-for-tests";
    process.env.MERCADO_LIVRE_CLIENT_ID = "123456789";
    process.env.MERCADO_LIVRE_CLIENT_SECRET = "client-secret-for-tests";
    process.env.MERCADO_LIVRE_REDIRECT_URI =
        "https://example.com/api/marketplace-accounts/mercadolivre/callback";
});
(0, node_test_1.afterEach)(() => {
    for (const key of environmentKeys) {
        const originalValue = originalEnvironment[key];
        if (originalValue === undefined) {
            delete process.env[key];
        }
        else {
            process.env[key] = originalValue;
        }
    }
});
(0, node_test_1.test)("monta a URL oficial de autorização somente com parâmetros conhecidos", () => {
    const url = new URL(new mercadoLivreOAuthClient_1.MercadoLivreOAuthClient().getAuthorizationUrl("state"));
    strict_1.default.equal(url.origin, "https://auth.mercadolivre.com.br");
    strict_1.default.equal(url.pathname, "/authorization");
    strict_1.default.deepEqual([...url.searchParams.keys()].sort(), [
        "client_id",
        "redirect_uri",
        "response_type",
        "state",
    ]);
    strict_1.default.equal(url.searchParams.get("response_type"), "code");
    strict_1.default.equal(url.searchParams.get("client_id"), "123456789");
    strict_1.default.equal(url.searchParams.get("state"), "state");
});
(0, node_test_1.test)("valida o state e recupera o usuário que iniciou a conexão", () => {
    const userId = "b337d0f4-a0a4-4d00-8f29-7800c3c53f62";
    const session = (0, mercadoLivreOAuthState_1.createMercadoLivreOAuthState)(userId);
    strict_1.default.deepEqual((0, mercadoLivreOAuthState_1.validateMercadoLivreOAuthState)(session.state, session.cookieValue), { userId });
});
(0, node_test_1.test)("rejeita state diferente do que iniciou a conexão", () => {
    const session = (0, mercadoLivreOAuthState_1.createMercadoLivreOAuthState)("b337d0f4-a0a4-4d00-8f29-7800c3c53f62");
    strict_1.default.throws(() => (0, mercadoLivreOAuthState_1.validateMercadoLivreOAuthState)("outro-state", session.cookieValue), AppError_1.AppError);
});
(0, node_test_1.test)("troca o authorization code sem enviar segredo pela URL", async () => {
    const mockFetch = (async (input, init) => {
        const url = String(input);
        const body = init?.body;
        strict_1.default.equal(url, "https://api.mercadolibre.com/oauth/token");
        strict_1.default.equal(init?.method, "POST");
        strict_1.default.ok(body instanceof URLSearchParams);
        strict_1.default.equal(body.get("grant_type"), "authorization_code");
        strict_1.default.equal(body.get("code"), "authorization-code");
        strict_1.default.equal(body.get("client_secret"), "client-secret-for-tests");
        strict_1.default.equal(new URL(url).search, "");
        return new Response(JSON.stringify({
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 21600,
            user_id: 123456789,
        }), { status: 200 });
    });
    const client = new mercadoLivreOAuthClient_1.MercadoLivreOAuthClient(mockFetch);
    const tokenSet = await client.exchangeAuthorizationCode("authorization-code");
    strict_1.default.deepEqual(tokenSet, {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 21600,
        userId: "123456789",
    });
});
(0, node_test_1.test)("renova o token e preserva o novo refresh token retornado", async () => {
    const mockFetch = (async (_input, init) => {
        const body = init?.body;
        strict_1.default.ok(body instanceof URLSearchParams);
        strict_1.default.equal(body.get("grant_type"), "refresh_token");
        strict_1.default.equal(body.get("refresh_token"), "old-refresh-token");
        return new Response(JSON.stringify({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 21600,
            user_id: "123456789",
        }), { status: 200 });
    });
    const tokenSet = await new mercadoLivreOAuthClient_1.MercadoLivreOAuthClient(mockFetch).refreshAccessToken("old-refresh-token");
    strict_1.default.equal(tokenSet.accessToken, "new-access-token");
    strict_1.default.equal(tokenSet.refreshToken, "new-refresh-token");
});
(0, node_test_1.test)("revoga a autorização sem enviar o token pela URL", async () => {
    const mockFetch = (async (input, init) => {
        const url = new URL(String(input));
        const headers = new Headers(init?.headers);
        strict_1.default.equal(init?.method, "DELETE");
        strict_1.default.equal(url.toString(), "https://api.mercadolibre.com/users/123456789/applications/123456789");
        strict_1.default.equal(headers.get("Authorization"), "Bearer access-token");
        strict_1.default.equal(url.searchParams.has("access_token"), false);
        return new Response(null, { status: 204 });
    });
    await new mercadoLivreOAuthClient_1.MercadoLivreOAuthClient(mockFetch).revokeAuthorization("123456789", "access-token");
});
//# sourceMappingURL=mercadoLivreOAuth.test.js.map