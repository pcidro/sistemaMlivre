"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisconnectMercadoLivreAccountService = void 0;
const AppError_1 = require("../../errors/AppError");
const mercadoLivreOAuthClient_1 = require("../../integrations/mercadolivre/mercadoLivreOAuthClient");
const mercadoLivreTokenService_1 = require("../../integrations/mercadolivre/mercadoLivreTokenService");
const prisma_1 = require("../../lib/prisma");
class DisconnectMercadoLivreAccountService {
    findOwnedAccount;
    getValidAccessToken;
    revokeAuthorization;
    clearCredentials;
    constructor(dependencies = {}) {
        const tokenService = new mercadoLivreTokenService_1.MercadoLivreTokenService();
        const oauthClient = new mercadoLivreOAuthClient_1.MercadoLivreOAuthClient();
        this.findOwnedAccount =
            dependencies.findOwnedAccount ??
                ((marketplaceAccountId, userId) => prisma_1.prisma.marketplaceAccount.findFirst({
                    where: {
                        id: marketplaceAccountId,
                        userId,
                        platform: "MERCADO_LIVRE",
                        isActive: true,
                    },
                    select: {
                        id: true,
                        externalAccountId: true,
                    },
                }));
        this.getValidAccessToken =
            dependencies.getValidAccessToken ??
                ((marketplaceAccountId) => tokenService.getValidAccessToken(marketplaceAccountId));
        this.revokeAuthorization =
            dependencies.revokeAuthorization ??
                ((externalAccountId, accessToken) => oauthClient.revokeAuthorization(externalAccountId, accessToken));
        this.clearCredentials =
            dependencies.clearCredentials ??
                (async (marketplaceAccountId) => {
                    await prisma_1.prisma.marketplaceAccount.update({
                        where: { id: marketplaceAccountId },
                        data: {
                            accessTokenEncrypted: "",
                            refreshTokenEncrypted: null,
                            tokenExpiresAt: null,
                            isActive: false,
                        },
                    });
                });
    }
    async execute(marketplaceAccountId, userId) {
        const account = await this.findOwnedAccount(marketplaceAccountId, userId);
        if (!account) {
            throw new AppError_1.AppError("Conta do Mercado Livre não encontrada para este usuário", 404);
        }
        const accessToken = await this.getValidAccessToken(account.id);
        await this.revokeAuthorization(account.externalAccountId, accessToken);
        await this.clearCredentials(account.id);
    }
}
exports.DisconnectMercadoLivreAccountService = DisconnectMercadoLivreAccountService;
//# sourceMappingURL=disconnectMercadoLivreAccountService.js.map