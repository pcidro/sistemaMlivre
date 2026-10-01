export interface MercadoLivreTokenSet {
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
    userId: string;
}
export interface MercadoLivreAuthenticatedAccount {
    externalAccountId: string;
    name: string;
    cnpj: string | null;
}
type FetchFunction = typeof globalThis.fetch;
export declare class MercadoLivreOAuthClient {
    private readonly fetchFn;
    constructor(fetchFn?: FetchFunction);
    getAuthorizationUrl(state: string): string;
    exchangeAuthorizationCode(code: string): Promise<MercadoLivreTokenSet>;
    refreshAccessToken(refreshToken: string): Promise<MercadoLivreTokenSet>;
    getAuthenticatedAccount(accessToken: string): Promise<MercadoLivreAuthenticatedAccount>;
    revokeAuthorization(externalAccountId: string, accessToken: string): Promise<void>;
    private requestToken;
}
export {};
//# sourceMappingURL=mercadoLivreOAuthClient.d.ts.map