"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoLivreOAuthClient = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const mercadoLivreConfig_1 = require("./mercadoLivreConfig");
const MERCADO_LIVRE_AUTHORIZATION_URL = "https://auth.mercadolivre.com.br/authorization";
const MERCADO_LIVRE_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const MERCADO_LIVRE_CURRENT_USER_URL = "https://api.mercadolibre.com/users/me";
const externalIdSchema = zod_1.z.union([zod_1.z.string().min(1), zod_1.z.number().int().positive()]);
const tokenResponseSchema = zod_1.z.object({
    access_token: zod_1.z.string().min(1),
    refresh_token: zod_1.z.string().min(1),
    expires_in: zod_1.z.number().int().positive(),
    user_id: externalIdSchema,
});
const accountResponseSchema = zod_1.z.object({
    id: externalIdSchema,
    nickname: zod_1.z.string().nullable().optional(),
    first_name: zod_1.z.string().nullable().optional(),
    last_name: zod_1.z.string().nullable().optional(),
    identification: zod_1.z
        .object({
        type: zod_1.z.string().nullable().optional(),
        number: zod_1.z.string().nullable().optional(),
    })
        .nullable()
        .optional(),
    company: zod_1.z
        .object({
        brand_name: zod_1.z.string().nullable().optional(),
        corporate_name: zod_1.z.string().nullable().optional(),
    })
        .nullable()
        .optional(),
});
function normalizeExternalId(value) {
    if (typeof value === "number") {
        if (!Number.isSafeInteger(value)) {
            throw new AppError_1.AppError("O Mercado Livre retornou um identificador de conta inválido", 502);
        }
        return String(value);
    }
    if (!/^\d+$/.test(value)) {
        throw new AppError_1.AppError("O Mercado Livre retornou um identificador de conta inválido", 502);
    }
    return value;
}
function resolveAccountName(account, externalAccountId) {
    const fullName = [account.first_name, account.last_name]
        .filter((part) => Boolean(part?.trim()))
        .join(" ")
        .trim();
    return (account.company?.brand_name?.trim() ||
        account.company?.corporate_name?.trim() ||
        account.nickname?.trim() ||
        fullName ||
        `Mercado Livre ${externalAccountId}`);
}
class MercadoLivreOAuthClient {
    fetchFn;
    constructor(fetchFn = globalThis.fetch) {
        this.fetchFn = fetchFn;
    }
    getAuthorizationUrl(state) {
        const config = (0, mercadoLivreConfig_1.getMercadoLivreConfig)();
        const url = new URL(MERCADO_LIVRE_AUTHORIZATION_URL);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("client_id", config.clientId);
        url.searchParams.set("redirect_uri", config.redirectUri);
        url.searchParams.set("state", state);
        return url.toString();
    }
    async exchangeAuthorizationCode(code) {
        const config = (0, mercadoLivreConfig_1.getMercadoLivreConfig)();
        return this.requestToken(new URLSearchParams({
            grant_type: "authorization_code",
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: config.redirectUri,
        }));
    }
    async refreshAccessToken(refreshToken) {
        const config = (0, mercadoLivreConfig_1.getMercadoLivreConfig)();
        return this.requestToken(new URLSearchParams({
            grant_type: "refresh_token",
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken,
        }));
    }
    async getAuthenticatedAccount(accessToken) {
        let response;
        try {
            response = await this.fetchFn(MERCADO_LIVRE_CURRENT_USER_URL, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
            });
        }
        catch {
            throw new AppError_1.AppError("Não foi possível consultar a conta do Mercado Livre", 502);
        }
        if (!response.ok) {
            throw new AppError_1.AppError("O Mercado Livre recusou a consulta da conta autenticada", 502);
        }
        try {
            const account = accountResponseSchema.parse(await response.json());
            const externalAccountId = normalizeExternalId(account.id);
            const identificationType = account.identification?.type?.toUpperCase();
            return {
                externalAccountId,
                name: resolveAccountName(account, externalAccountId),
                cnpj: identificationType === "CNPJ"
                    ? (account.identification?.number ?? null)
                    : null,
            };
        }
        catch (error) {
            if (error instanceof AppError_1.AppError) {
                throw error;
            }
            throw new AppError_1.AppError("O Mercado Livre retornou dados de conta inválidos", 502);
        }
    }
    async requestToken(body) {
        let response;
        try {
            response = await this.fetchFn(MERCADO_LIVRE_TOKEN_URL, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body,
            });
        }
        catch {
            throw new AppError_1.AppError("Não foi possível comunicar com a autenticação do Mercado Livre", 502);
        }
        if (!response.ok) {
            throw new AppError_1.AppError("O Mercado Livre recusou a autenticação da conta", 502);
        }
        try {
            const token = tokenResponseSchema.parse(await response.json());
            return {
                accessToken: token.access_token,
                refreshToken: token.refresh_token,
                expiresInSeconds: token.expires_in,
                userId: normalizeExternalId(token.user_id),
            };
        }
        catch (error) {
            if (error instanceof AppError_1.AppError) {
                throw error;
            }
            throw new AppError_1.AppError("O Mercado Livre retornou credenciais OAuth inválidas", 502);
        }
    }
}
exports.MercadoLivreOAuthClient = MercadoLivreOAuthClient;
//# sourceMappingURL=mercadoLivreOAuthClient.js.map