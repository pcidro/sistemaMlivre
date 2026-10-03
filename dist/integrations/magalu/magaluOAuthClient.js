"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MagaluOAuthClient = void 0;
const node_crypto_1 = require("node:crypto");
const AppError_1 = require("../../errors/AppError");
const magaluOAuthConfig_1 = require("./magaluOAuthConfig");
const magaluTokenResponse_1 = require("./magaluTokenResponse");
const magaluHttpError_1 = require("./magaluHttpError");
class MagaluOAuthClient {
    fetchFn;
    constructor(fetchFn = globalThis.fetch) {
        this.fetchFn = fetchFn;
    }
    getAuthorizationUrl(state, config) {
        const url = new URL(config.authorizationUrl);
        url.search = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            scope: magaluOAuthConfig_1.MAGALU_OAUTH_SCOPES.join(" "),
            response_type: "code",
            choose_tenants: "true",
            state,
        }).toString();
        return url.toString();
    }
    async exchangeAuthorizationCode(code, config) {
        try {
            const response = await this.fetchFn(config.tokenUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    redirect_uri: config.redirectUri,
                    code,
                    grant_type: "authorization_code",
                }),
                redirect: "error",
                signal: AbortSignal.timeout(15_000),
            });
            if (!response.ok)
                throw new Error("Token exchange refused");
            const tokens = (0, magaluTokenResponse_1.parseMagaluTokenResponse)(await response.json(), config);
            if (!tokens.refreshToken)
                throw new Error("Missing refresh token");
            return { ...tokens, refreshToken: tokens.refreshToken };
        }
        catch {
            // Não propagar body, credenciais, erro de rede ou query string do provedor.
            throw new AppError_1.AppError("Não foi possível concluir a troca do código de autorização da Magalu. Inicie uma nova conexão.", 502);
        }
    }
    async refreshAccessToken(refreshToken, config) {
        const requestId = (0, node_crypto_1.randomUUID)();
        let response;
        try {
            response = await this.fetchFn(config.tokenUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "X-Request-ID": requestId },
                body: new URLSearchParams({ grant_type: "refresh_token", client_id: config.clientId,
                    client_secret: config.clientSecret, refresh_token: refreshToken }),
                redirect: "error",
                signal: AbortSignal.timeout(15_000),
            });
        }
        catch {
            // Não repetir automaticamente: o servidor pode ter rotacionado o refresh.
            throw new magaluHttpError_1.MagaluHttpError("Não foi possível comunicar com o ID Magalu para renovar a autorização.", 503, "network", null, requestId);
        }
        if (!response.ok) {
            const error = (0, magaluHttpError_1.magaluHttpFailure)(response, Date.now(), requestId, true);
            await (0, magaluHttpError_1.discardMagaluResponse)(response);
            throw error;
        }
        try {
            return (0, magaluTokenResponse_1.parseMagaluTokenResponse)(await response.json(), config);
        }
        catch {
            throw new magaluHttpError_1.MagaluHttpError("O ID Magalu retornou credenciais de renovação inválidas.", 502, "invalid_response", response.status, (0, magaluHttpError_1.safeMagaluRequestId)(response.headers) ?? requestId);
        }
    }
}
exports.MagaluOAuthClient = MagaluOAuthClient;
//# sourceMappingURL=magaluOAuthClient.js.map