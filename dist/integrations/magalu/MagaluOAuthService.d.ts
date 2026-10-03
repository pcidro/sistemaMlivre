import { MagaluOAuthClient } from "./magaluOAuthClient";
import { type MagaluOAuthConfig } from "./magaluOAuthConfig";
import { type MagaluOAuthStorage } from "./magaluOAuthStorage";
export declare const MAGALU_STATE_COOKIE = "magalu_oauth_state";
export declare const MAGALU_STATE_COOKIE_PATH = "/api/marketplace-accounts/magalu/callback";
export declare const MAGALU_STATE_MAX_AGE: number;
export declare class MagaluOAuthService {
    private readonly client;
    private readonly storage;
    private readonly getConfig;
    constructor(client?: MagaluOAuthClient, storage?: MagaluOAuthStorage, getConfig?: () => MagaluOAuthConfig);
    createAuthorization(userId: string): Promise<{
        authorizationUrl: string;
        stateCookieValue: string;
    }>;
    completeAuthorization(query: {
        state: string;
        code?: string;
        error?: string;
    }, cookieValue: string | undefined): Promise<void>;
    private hashState;
    private safeError;
}
//# sourceMappingURL=MagaluOAuthService.d.ts.map