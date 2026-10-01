interface OwnedAccount {
    id: string;
    externalAccountId: string;
}
interface DisconnectMercadoLivreAccountDependencies {
    findOwnedAccount?: (marketplaceAccountId: string, userId: string) => Promise<OwnedAccount | null>;
    getValidAccessToken?: (marketplaceAccountId: string) => Promise<string>;
    revokeAuthorization?: (externalAccountId: string, accessToken: string) => Promise<void>;
    clearCredentials?: (marketplaceAccountId: string) => Promise<void>;
}
export declare class DisconnectMercadoLivreAccountService {
    private readonly findOwnedAccount;
    private readonly getValidAccessToken;
    private readonly revokeAuthorization;
    private readonly clearCredentials;
    constructor(dependencies?: DisconnectMercadoLivreAccountDependencies);
    execute(marketplaceAccountId: string, userId: string): Promise<void>;
}
export {};
//# sourceMappingURL=disconnectMercadoLivreAccountService.d.ts.map