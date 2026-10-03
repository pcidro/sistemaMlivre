export declare const MAGALU_OAUTH_SCOPES: readonly ["open:order-order-seller:read", "open:order-delivery-seller:read", "open:order-invoice-seller:read"];
export declare function getMagaluOAuthConfig(env?: Readonly<Record<string, string | undefined>>): {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authorizationUrl: string;
    tokenUrl: string;
    environment: import("./magaluConfig").MagaluEnvironment;
    audience: string;
};
export type MagaluOAuthConfig = ReturnType<typeof getMagaluOAuthConfig>;
export declare function magaluOAuthConfigFingerprint(config: MagaluOAuthConfig): string;
//# sourceMappingURL=magaluOAuthConfig.d.ts.map