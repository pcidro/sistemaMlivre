"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoLivreTokenService = void 0;
const AppError_1 = require("../../errors/AppError");
const prisma_1 = require("../../lib/prisma");
const tokenEncryption_1 = require("../../utils/tokenEncryption");
const mercadoLivreOAuthClient_1 = require("./mercadoLivreOAuthClient");
const TOKEN_EXPIRATION_MARGIN_MILLISECONDS = 60 * 1000;
class MercadoLivreTokenService {
    oauthClient;
    dependencies;
    refreshes = new Map();
    constructor(oauthClient = new mercadoLivreOAuthClient_1.MercadoLivreOAuthClient(), dependencies = {}) {
        this.oauthClient = oauthClient;
        this.dependencies = dependencies;
    }
    async getValidAccessToken(marketplaceAccountId) {
        const account = await this.getAccountCredentials(marketplaceAccountId);
        const validUntil = account.tokenExpiresAt?.getTime() ?? Number.NEGATIVE_INFINITY;
        if (validUntil > Date.now() + TOKEN_EXPIRATION_MARGIN_MILLISECONDS) {
            return (0, tokenEncryption_1.decryptToken)(account.accessTokenEncrypted);
        }
        return this.refreshAccessToken(marketplaceAccountId);
    }
    async refreshAccessToken(marketplaceAccountId) {
        const pending = this.refreshes.get(marketplaceAccountId);
        if (pending)
            return pending;
        const refresh = this.performRefresh(marketplaceAccountId);
        this.refreshes.set(marketplaceAccountId, refresh);
        try {
            return await refresh;
        }
        finally {
            this.refreshes.delete(marketplaceAccountId);
        }
    }
    async performRefresh(marketplaceAccountId) {
        const account = await this.getAccountCredentials(marketplaceAccountId);
        if (!account.refreshTokenEncrypted) {
            throw new AppError_1.AppError("A conta do Mercado Livre precisa ser conectada novamente", 409);
        }
        const refreshToken = (0, tokenEncryption_1.decryptToken)(account.refreshTokenEncrypted);
        const tokens = await this.oauthClient.refreshAccessToken(refreshToken);
        if (tokens.userId !== account.externalAccountId) {
            throw new AppError_1.AppError("O Mercado Livre retornou credenciais de outra conta", 502);
        }
        const credentials = {
            accessTokenEncrypted: (0, tokenEncryption_1.encryptToken)(tokens.accessToken),
            refreshTokenEncrypted: (0, tokenEncryption_1.encryptToken)(tokens.refreshToken),
            tokenExpiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000),
        };
        if (this.dependencies.saveCredentials) {
            await this.dependencies.saveCredentials(account.id, credentials);
        }
        else {
            await prisma_1.prisma.marketplaceAccount.update({ where: { id: account.id }, data: credentials });
        }
        return tokens.accessToken;
    }
    async getAccountCredentials(marketplaceAccountId) {
        const account = this.dependencies.findAccount
            ? await this.dependencies.findAccount(marketplaceAccountId)
            : await prisma_1.prisma.marketplaceAccount.findUnique({
                where: { id: marketplaceAccountId },
                select: {
                    id: true,
                    platform: true,
                    externalAccountId: true,
                    accessTokenEncrypted: true,
                    refreshTokenEncrypted: true,
                    tokenExpiresAt: true,
                    isActive: true,
                },
            });
        if (!account ||
            account.platform !== "MERCADO_LIVRE" ||
            !account.isActive) {
            throw new AppError_1.AppError("Conta do Mercado Livre não encontrada ou inativa", 404);
        }
        return account;
    }
}
exports.MercadoLivreTokenService = MercadoLivreTokenService;
//# sourceMappingURL=mercadoLivreTokenService.js.map