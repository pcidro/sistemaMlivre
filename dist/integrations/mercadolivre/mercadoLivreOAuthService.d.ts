import { MercadoLivreOAuthClient } from "./mercadoLivreOAuthClient";
export declare class MercadoLivreOAuthService {
    private readonly oauthClient;
    constructor(oauthClient?: MercadoLivreOAuthClient);
    createAuthorization(userId: string): {
        authorizationUrl: string;
        stateCookieValue: string;
    };
    completeAuthorization(code: string, initiatedByUserId: string): Promise<{
        cnpj: string | null;
        createdAt: Date;
        externalAccountId: string;
        id: string;
        isActive: boolean;
        name: string;
        platform: import("../../generated/prisma/enums").MarketplacePlatform;
        tokenExpiresAt: Date | null;
        updatedAt: Date;
    }>;
}
//# sourceMappingURL=mercadoLivreOAuthService.d.ts.map