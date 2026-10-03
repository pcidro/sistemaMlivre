"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_http_1 = require("node:http");
const node_test_1 = require("node:test");
const express_1 = __importDefault(require("express"));
const tokenEncryption_1 = require("../../utils/tokenEncryption");
const mercadoLivreOAuthClient_1 = require("../../integrations/mercadolivre/mercadoLivreOAuthClient");
const mercadoLivreOAuthService_1 = require("../../integrations/mercadolivre/mercadoLivreOAuthService");
const mercadoLivreOAuthState_1 = require("../../integrations/mercadolivre/mercadoLivreOAuthState");
const mercadoLivreOAuthController_1 = require("./mercadoLivreOAuthController");
const userId = "b337d0f4-a0a4-4d00-8f29-7800c3c53f62";
const fakeAccessToken = "access-token-never-log";
const fakeRefreshToken = "refresh-token-never-log";
const fakeCode = "authorization-code-never-log";
const keys = ["JWT_SECRET", "NODE_ENV", "FRONTEND_URL", "TOKEN_ENCRYPTION_KEY", "MERCADO_LIVRE_CLIENT_ID", "MERCADO_LIVRE_CLIENT_SECRET", "MERCADO_LIVRE_REDIRECT_URI"];
const previousEnvironment = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const connectedAccount = {
    id: "account-id", platform: "MERCADO_LIVRE", name: "Loja fictícia",
    cnpj: null, externalAccountId: "123", tokenExpiresAt: new Date(), isActive: true,
    createdAt: new Date(), updatedAt: new Date(),
};
const storage = {
    findUser: async () => ({ id: userId }),
    findAccount: async () => null,
    saveAccount: async () => connectedAccount,
};
(0, node_test_1.beforeEach)(() => {
    process.env.JWT_SECRET = "state-signing-secret-never-log";
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_URL = "https://frontend.example";
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    process.env.MERCADO_LIVRE_CLIENT_ID = "123";
    process.env.MERCADO_LIVRE_CLIENT_SECRET = "client-secret-never-log";
    process.env.MERCADO_LIVRE_REDIRECT_URI = "https://frontend.example/api/marketplace-accounts/mercadolivre/callback";
});
(0, node_test_1.afterEach)(() => {
    for (const key of keys) {
        if (previousEnvironment[key] === undefined)
            delete process.env[key];
        else
            process.env[key] = previousEnvironment[key];
    }
});
async function withApi(work, options = {}) {
    const fetchFn = (async (input) => {
        if (String(input).endsWith("/oauth/token")) {
            if (options.tokenError)
                return Response.json({ error: options.tokenError, error_description: fakeAccessToken }, { status: options.tokenStatus ?? 400 });
            return Response.json({ access_token: fakeAccessToken, refresh_token: fakeRefreshToken, user_id: 123, expires_in: 3600 });
        }
        strict_1.default.equal(String(input), "https://api.mercadolibre.com/users/me");
        if (options.accountStatus)
            return Response.json({ error: "forbidden", message: fakeAccessToken }, { status: options.accountStatus });
        return Response.json({ id: 123, nickname: "Loja fictícia" });
    });
    const controller = new mercadoLivreOAuthController_1.MercadoLivreOAuthController(new mercadoLivreOAuthService_1.MercadoLivreOAuthService(new mercadoLivreOAuthClient_1.MercadoLivreOAuthClient(fetchFn), storage));
    const app = (0, express_1.default)();
    app.get("/connect", (req, res) => { req.user_id = userId; return controller.connect(req, res); });
    app.get("/callback", (req, res) => controller.callback(req, res));
    const server = (0, node_http_1.createServer)(app);
    try {
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        await work(`http://127.0.0.1:${server.address().port}`);
    }
    finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(() => resolve()));
    }
}
function callbackRequest(baseUrl, cookie = true, query) {
    const session = (0, mercadoLivreOAuthState_1.createMercadoLivreOAuthState)(userId);
    return fetch(`${baseUrl}/callback?${query ?? new URLSearchParams({ code: fakeCode, state: session.state })}`, {
        redirect: "manual",
        headers: cookie ? { Cookie: `${mercadoLivreOAuthState_1.MERCADO_LIVRE_OAUTH_STATE_COOKIE}=${encodeURIComponent(session.cookieValue)}` } : {},
    });
}
(0, node_test_1.test)("conexão emite cookie seguro e usa o callback do frontend", async () => {
    await withApi(async (url) => {
        const response = await fetch(`${url}/connect`, { redirect: "manual" });
        const cookie = response.headers.get("set-cookie") ?? "";
        strict_1.default.match(cookie, /HttpOnly/);
        strict_1.default.match(cookie, /Secure/);
        strict_1.default.match(cookie, /SameSite=Lax/);
        strict_1.default.match(cookie, /Path=\/api\/marketplace-accounts\/mercadolivre\/callback/);
        const location = new URL(response.headers.get("location"));
        strict_1.default.equal(location.searchParams.get("redirect_uri"), process.env.MERCADO_LIVRE_REDIRECT_URI);
    });
});
(0, node_test_1.test)("callback salva tokens criptografados e sinaliza sucesso somente após persistir", async (context) => {
    const save = context.mock.method(storage, "saveAccount", async (args) => {
        strict_1.default.equal(args.create.userId, userId);
        strict_1.default.ok(typeof args.create.accessTokenEncrypted === "string");
        strict_1.default.ok(typeof args.create.refreshTokenEncrypted === "string");
        strict_1.default.equal((0, tokenEncryption_1.decryptToken)(args.create.accessTokenEncrypted), fakeAccessToken);
        strict_1.default.equal((0, tokenEncryption_1.decryptToken)(args.create.refreshTokenEncrypted), fakeRefreshToken);
        strict_1.default.equal(args.select?.accessTokenEncrypted, undefined);
        return connectedAccount;
    });
    await withApi(async (url) => {
        const response = await callbackRequest(url);
        strict_1.default.equal(response.headers.get("location"), "https://frontend.example/?mercadolivre=success");
        strict_1.default.match(response.headers.get("set-cookie") ?? "", /Expires=Thu, 01 Jan 1970/);
        strict_1.default.equal(save.mock.callCount(), 1);
    });
});
const failures = [
    { reason: "state_missing", cookie: false },
    { reason: "state_invalid", query: { state: "wrong-state", code: fakeCode } },
    { reason: "authorization_denied", providerDenied: true },
    { reason: "callback_invalid", missingCode: true },
    { reason: "token_exchange_failed", tokenError: "invalid_client" },
    { reason: "token_exchange_failed", tokenError: "invalid_grant" },
    { reason: "token_exchange_failed", tokenError: "unrecognized-secret-never-log" },
    { reason: "account_lookup_failed", accountStatus: 403 },
    { reason: "account_already_linked", ownerId: "another-local-user" },
    { reason: "encryption_configuration", invalidEncryptionKey: true },
    { reason: "persistence_failed", databaseFails: true },
];
for (const failure of failures) {
    (0, node_test_1.test)(`callback identifica ${failure.reason}${"tokenError" in failure ? ` (${failure.tokenError.startsWith("invalid_") ? failure.tokenError : "código desconhecido"})` : ""} sem vazar dados`, async (context) => {
        context.mock.method(storage, "findAccount", async () => "ownerId" in failure ? { userId: failure.ownerId } : null);
        const save = context.mock.method(storage, "saveAccount", async () => {
            if ("databaseFails" in failure)
                throw new Error(`Database error ${fakeAccessToken}`);
            throw new Error("Não deveria persistir neste teste");
        });
        const logger = context.mock.method(console, "error", () => { });
        if ("invalidEncryptionKey" in failure)
            process.env.TOKEN_ENCRYPTION_KEY = "invalid-key-never-log";
        await withApi(async (url) => {
            let response;
            if ("providerDenied" in failure || "missingCode" in failure) {
                const session = (0, mercadoLivreOAuthState_1.createMercadoLivreOAuthState)(userId);
                const params = new URLSearchParams({ state: session.state });
                if ("providerDenied" in failure)
                    params.set("error", "access_denied");
                response = await fetch(`${url}/callback?${params}`, { redirect: "manual", headers: { Cookie: `${mercadoLivreOAuthState_1.MERCADO_LIVRE_OAUTH_STATE_COOKIE}=${session.cookieValue}` } });
            }
            else {
                response = await callbackRequest(url, !("cookie" in failure), "query" in failure ? new URLSearchParams(failure.query) : undefined);
            }
            const location = response.headers.get("location");
            const params = new URL(location).searchParams;
            strict_1.default.equal(params.get("mercadolivre"), "error");
            strict_1.default.equal(params.get("mercadolivre_error"), failure.reason);
            strict_1.default.equal(save.mock.callCount(), "databaseFails" in failure ? 1 : 0);
            const log = logger.mock.calls[0]?.arguments[1];
            strict_1.default.equal(log.reason, failure.reason);
            if ("tokenError" in failure) {
                strict_1.default.equal(log.upstreamStatus, 400);
                strict_1.default.equal(log.upstreamError, failure.tokenError.startsWith("invalid_") ? failure.tokenError : null);
            }
            const output = JSON.stringify(logger.mock.calls.map((call) => call.arguments)) + location + await response.text();
            for (const secret of [fakeAccessToken, fakeRefreshToken, fakeCode, "client-secret-never-log", "state-signing-secret-never-log", "unrecognized-secret-never-log", "invalid-key-never-log"])
                strict_1.default.ok(!output.includes(secret));
        }, {
            ...("tokenError" in failure ? { tokenError: failure.tokenError } : {}),
            ...("accountStatus" in failure ? { accountStatus: failure.accountStatus } : {}),
        });
    });
}
//# sourceMappingURL=mercadoLivreOAuthController.test.js.map