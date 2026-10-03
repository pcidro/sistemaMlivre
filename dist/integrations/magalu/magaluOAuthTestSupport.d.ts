import type { MagaluOAuthStorage, PendingMagaluAuthorization, MagaluAccountAuthorization } from "./magaluOAuthStorage";
export declare const testUserId = "00000000-0000-4000-8000-000000000001";
export declare const otherUserId = "00000000-0000-4000-8000-000000000002";
export declare const tenantId = "GENPUB.00000000-0000-4000-8000-000000000003";
export declare const oauthTestEnv: {
    NODE_ENV: string;
    MAGALU_CLIENT_ID: string;
    MAGALU_CLIENT_SECRET: string;
    MAGALU_REDIRECT_URI: string;
    MAGALU_AUTH_URL: string;
    MAGALU_ENV: string;
};
export declare const oauthTestConfig: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authorizationUrl: string;
    tokenUrl: string;
    environment: import("./magaluConfig").MagaluEnvironment;
    audience: string;
};
export declare function tokenFixture(claims?: Record<string, unknown>): {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    created_at: number;
    scope: string;
};
export declare class MemoryMagaluStorage implements MagaluOAuthStorage {
    states: Map<string, PendingMagaluAuthorization>;
    accounts: Map<string, MagaluAccountAuthorization>;
    users: Set<string>;
    createState(state: PendingMagaluAuthorization): Promise<void>;
    consumeState(hash: string, fingerprint: string, now: Date): Promise<{
        userId: string;
    } | null>;
    userExists(id: string): Promise<boolean>;
    saveAccount(account: MagaluAccountAuthorization): Promise<void>;
    findState(state: string): PendingMagaluAuthorization | undefined;
}
//# sourceMappingURL=magaluOAuthTestSupport.d.ts.map