import { MercadoLivreOAuthClient } from "./mercadoLivreOAuthClient";
interface AccountCredentials {
    id: string;
    platform: string;
    externalAccountId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string | null;
    tokenExpiresAt: Date | null;
    isActive: boolean;
}
interface SavedCredentials {
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string;
    tokenExpiresAt: Date;
}
interface TokenServiceDependencies {
    findAccount?: (id: string) => Promise<AccountCredentials | null>;
    saveCredentials?: (id: string, credentials: SavedCredentials) => Promise<void>;
}
export declare class MercadoLivreTokenService {
    private readonly oauthClient;
    private readonly dependencies;
    private readonly refreshes;
    constructor(oauthClient?: MercadoLivreOAuthClient, dependencies?: TokenServiceDependencies);
    getValidAccessToken(marketplaceAccountId: string): Promise<string>;
    refreshAccessToken(marketplaceAccountId: string): Promise<string>;
    private performRefresh;
    private getAccountCredentials;
}
export {};
//# sourceMappingURL=mercadoLivreTokenService.d.ts.map