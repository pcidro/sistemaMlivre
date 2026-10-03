import { type MagaluOAuthConfig } from "./magaluOAuthConfig";
/** Somente tokens do endpoint HTTPS oficial ou do armazenamento criptografado. */
export declare function readMagaluTokenClaims(accessToken: string, audience: string): {
    sub: string;
    exp: number;
    aud: string | string[];
};
export declare function parseMagaluTokenResponse(raw: unknown, config: MagaluOAuthConfig, now?: number): {
    accessToken: string;
    refreshToken: string | undefined;
    tokenExpiresAt: Date;
    externalAccountId: string;
};
//# sourceMappingURL=magaluTokenResponse.d.ts.map