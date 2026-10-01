import { MercadoLivreOAuthClient } from "./mercadoLivreOAuthClient";
export declare class MercadoLivreTokenService {
    private readonly oauthClient;
    constructor(oauthClient?: MercadoLivreOAuthClient);
    getValidAccessToken(marketplaceAccountId: string): Promise<string>;
    refreshAccessToken(marketplaceAccountId: string): Promise<string>;
    private getAccountCredentials;
}
//# sourceMappingURL=mercadoLivreTokenService.d.ts.map