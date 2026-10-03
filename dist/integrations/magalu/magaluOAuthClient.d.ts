import { type MagaluOAuthConfig } from "./magaluOAuthConfig";
export declare class MagaluOAuthClient {
    private readonly fetchFn;
    constructor(fetchFn?: typeof globalThis.fetch);
    getAuthorizationUrl(state: string, config: MagaluOAuthConfig): string;
    exchangeAuthorizationCode(code: string, config: MagaluOAuthConfig): Promise<{
        accessToken: string;
        tokenExpiresAt: Date;
        externalAccountId: string;
        refreshToken: string;
    }>;
    refreshAccessToken(refreshToken: string, config: MagaluOAuthConfig): Promise<{
        accessToken: string;
        refreshToken: string | undefined;
        tokenExpiresAt: Date;
        externalAccountId: string;
    }>;
}
//# sourceMappingURL=magaluOAuthClient.d.ts.map