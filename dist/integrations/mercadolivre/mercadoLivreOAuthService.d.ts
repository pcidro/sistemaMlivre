import type { MarketplaceAccount, Prisma } from "../../generated/prisma/client";
import { MercadoLivreOAuthClient } from "./mercadoLivreOAuthClient";
type ConnectedAccount = Pick<MarketplaceAccount, "id" | "platform" | "name" | "cnpj" | "externalAccountId" | "tokenExpiresAt" | "isActive" | "createdAt" | "updatedAt">;
interface OAuthAccountStorage {
    findUser(userId: string): Promise<{
        id: string;
    } | null>;
    findAccount(externalAccountId: string): Promise<{
        userId: string | null;
    } | null>;
    saveAccount(data: Prisma.MarketplaceAccountUpsertArgs): Promise<ConnectedAccount>;
}
export declare class MercadoLivreOAuthService {
    private readonly oauthClient;
    private readonly storage;
    constructor(oauthClient?: MercadoLivreOAuthClient, storage?: OAuthAccountStorage);
    createAuthorization(userId: string): {
        authorizationUrl: string;
        stateCookieValue: string;
    };
    completeAuthorization(code: string, initiatedByUserId: string): Promise<ConnectedAccount>;
    private connectAccount;
}
export {};
//# sourceMappingURL=mercadoLivreOAuthService.d.ts.map