"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoLivreOAuthService = void 0;
const AppError_1 = require("../../errors/AppError");
const prisma_1 = require("../../lib/prisma");
const tokenEncryption_1 = require("../../utils/tokenEncryption");
const mercadoLivreOAuthClient_1 = require("./mercadoLivreOAuthClient");
const mercadoLivreOAuthState_1 = require("./mercadoLivreOAuthState");
class MercadoLivreOAuthService {
    oauthClient;
    constructor(oauthClient = new mercadoLivreOAuthClient_1.MercadoLivreOAuthClient()) {
        this.oauthClient = oauthClient;
    }
    createAuthorization(userId) {
        const stateSession = (0, mercadoLivreOAuthState_1.createMercadoLivreOAuthState)(userId);
        return {
            authorizationUrl: this.oauthClient.getAuthorizationUrl(stateSession.state),
            stateCookieValue: stateSession.cookieValue,
        };
    }
    async completeAuthorization(code, initiatedByUserId) {
        const initiatingUser = await prisma_1.prisma.user.findUnique({
            where: { id: initiatedByUserId },
            select: { id: true },
        });
        if (!initiatingUser) {
            throw new AppError_1.AppError("Usuário que iniciou a conexão não encontrado", 401);
        }
        const tokens = await this.oauthClient.exchangeAuthorizationCode(code);
        const account = await this.oauthClient.getAuthenticatedAccount(tokens.accessToken);
        if (account.externalAccountId !== tokens.userId) {
            throw new AppError_1.AppError("A conta retornada pelo Mercado Livre não corresponde à autorização", 502);
        }
        const tokenExpiresAt = new Date(Date.now() + tokens.expiresInSeconds * 1000);
        return prisma_1.prisma.marketplaceAccount.upsert({
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
                accessTokenEncrypted: (0, tokenEncryption_1.encryptToken)(tokens.accessToken),
                refreshTokenEncrypted: (0, tokenEncryption_1.encryptToken)(tokens.refreshToken),
                tokenExpiresAt,
            },
            update: {
                name: account.name,
                cnpj: account.cnpj,
                accessTokenEncrypted: (0, tokenEncryption_1.encryptToken)(tokens.accessToken),
                refreshTokenEncrypted: (0, tokenEncryption_1.encryptToken)(tokens.refreshToken),
                tokenExpiresAt,
                isActive: true,
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