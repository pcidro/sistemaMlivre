"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoLivreOAuthService = void 0;
const prisma_1 = require("../../lib/prisma");
const tokenEncryption_1 = require("../../utils/tokenEncryption");
const mercadoLivreOAuthClient_1 = require("./mercadoLivreOAuthClient");
const mercadoLivreOAuthError_1 = require("./mercadoLivreOAuthError");
const mercadoLivreOAuthState_1 = require("./mercadoLivreOAuthState");
const accountStorage = {
    findUser: (id) => prisma_1.prisma.user.findUnique({ where: { id }, select: { id: true } }),
    findAccount: (externalAccountId) => prisma_1.prisma.marketplaceAccount.findUnique({
        where: { platform_externalAccountId: { platform: "MERCADO_LIVRE", externalAccountId } },
        select: { userId: true },
    }),
    saveAccount: (data) => prisma_1.prisma.marketplaceAccount.upsert(data),
};
class MercadoLivreOAuthService {
    oauthClient;
    storage;
    constructor(oauthClient = new mercadoLivreOAuthClient_1.MercadoLivreOAuthClient(), storage = accountStorage) {
        this.oauthClient = oauthClient;
        this.storage = storage;
    }
    createAuthorization(userId) {
        const stateSession = (0, mercadoLivreOAuthState_1.createMercadoLivreOAuthState)(userId);
        return {
            authorizationUrl: this.oauthClient.getAuthorizationUrl(stateSession.state),
            stateCookieValue: stateSession.cookieValue,
        };
    }
    async completeAuthorization(code, initiatedByUserId) {
        try {
            return await this.connectAccount(code, initiatedByUserId);
        }
        catch (error) {
            if (error instanceof mercadoLivreOAuthError_1.MercadoLivreOAuthError)
                throw error;
            if (error instanceof tokenEncryption_1.TokenEncryptionConfigurationError) {
                throw new mercadoLivreOAuthError_1.MercadoLivreOAuthError("Configuração de proteção dos tokens inválida", 500, "encryption_configuration");
            }
            throw new mercadoLivreOAuthError_1.MercadoLivreOAuthError("Não foi possível salvar a conexão do Mercado Livre", 500, "persistence_failed");
        }
    }
    async connectAccount(code, initiatedByUserId) {
        const initiatingUser = await this.storage.findUser(initiatedByUserId);
        if (!initiatingUser) {
            throw new mercadoLivreOAuthError_1.MercadoLivreOAuthError("Usuário que iniciou a conexão não encontrado", 401, "user_not_found");
        }
        const tokens = await this.oauthClient.exchangeAuthorizationCode(code);
        const account = await this.oauthClient.getAuthenticatedAccount(tokens.accessToken);
        if (account.externalAccountId !== tokens.userId) {
            throw new mercadoLivreOAuthError_1.MercadoLivreOAuthError("A conta retornada pelo Mercado Livre não corresponde à autorização", 502, "account_mismatch");
        }
        const tokenExpiresAt = new Date(Date.now() + tokens.expiresInSeconds * 1000);
        const existingAccount = await this.storage.findAccount(account.externalAccountId);
        if (existingAccount?.userId &&
            existingAccount.userId !== initiatedByUserId) {
            throw new mercadoLivreOAuthError_1.MercadoLivreOAuthError("Esta conta do Mercado Livre já pertence a outro usuário", 409, "account_already_linked");
        }
        const accessTokenEncrypted = (0, tokenEncryption_1.encryptToken)(tokens.accessToken);
        const refreshTokenEncrypted = (0, tokenEncryption_1.encryptToken)(tokens.refreshToken);
        return this.storage.saveAccount({
            where: {
                platform_externalAccountId: {
                    platform: "MERCADO_LIVRE",
                    externalAccountId: account.externalAccountId,
                },
            },
            create: {
                platform: "MERCADO_LIVRE",
                name: account.name,
                cnpj: account.cnpj,
                externalAccountId: account.externalAccountId,
                accessTokenEncrypted,
                refreshTokenEncrypted,
                tokenExpiresAt,
                userId: initiatedByUserId,
            },
            update: {
                name: account.name,
                cnpj: account.cnpj,
                accessTokenEncrypted,
                refreshTokenEncrypted,
                tokenExpiresAt,
                isActive: true,
                userId: initiatedByUserId,
            },
            select: {
                id: true,
                platform: true,
                name: true,
                cnpj: true,
                externalAccountId: true,
                tokenExpiresAt: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
}
exports.MercadoLivreOAuthService = MercadoLivreOAuthService;
//# sourceMappingURL=mercadoLivreOAuthService.js.map