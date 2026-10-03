"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readMagaluTokenClaims = readMagaluTokenClaims;
exports.parseMagaluTokenResponse = parseMagaluTokenResponse;
const jsonwebtoken_1 = require("jsonwebtoken");
const zod_1 = require("zod");
const magaluOAuthConfig_1 = require("./magaluOAuthConfig");
const tokensSchema = zod_1.z.object({
    access_token: zod_1.z.string().min(1).max(32768),
    refresh_token: zod_1.z.string().min(1).max(32768).optional(),
    token_type: zod_1.z.literal("Bearer"),
    expires_in: zod_1.z.number().int().positive().max(2_147_483_647),
    created_at: zod_1.z.number().int().positive().optional(),
    scope: zod_1.z.string().min(1),
});
const claimsSchema = zod_1.z.object({
    sub: zod_1.z.string().min(1).max(255).regex(/^[^\s\x00-\x1f\x7f]+$/),
    exp: zod_1.z.number().int().positive(),
    aud: zod_1.z.union([zod_1.z.string().min(1), zod_1.z.array(zod_1.z.string().min(1)).min(1)]),
});
/** Somente tokens do endpoint HTTPS oficial ou do armazenamento criptografado. */
function readMagaluTokenClaims(accessToken, audience) {
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(accessToken))
        throw new Error("Invalid JWT structure");
    // decode não autentica tokens fornecidos pelo navegador nem verifica assinatura.
    const jwt = (0, jsonwebtoken_1.decode)(accessToken, { complete: true });
    if (!jwt || jwt.header.alg === "none")
        throw new Error("Invalid JWT");
    const claims = claimsSchema.parse(jwt.payload);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(audience))
        throw new Error("Invalid audience");
    return claims;
}
function parseMagaluTokenResponse(raw, config, now = Date.now()) {
    const tokens = tokensSchema.parse(raw);
    const granted = new Set(tokens.scope.split(/\s+/));
    if (magaluOAuthConfig_1.MAGALU_OAUTH_SCOPES.some((scope) => !granted.has(scope)))
        throw new Error("Missing scopes");
    const claims = readMagaluTokenClaims(tokens.access_token, config.audience);
    if (tokens.created_at && tokens.created_at * 1000 > now + 60_000)
        throw new Error("Invalid creation time");
    const issuedAt = tokens.created_at ? Math.min(now, tokens.created_at * 1000) : now;
    const tokenExpiresAt = new Date(Math.min(issuedAt + tokens.expires_in * 1000, claims.exp * 1000));
    if (tokenExpiresAt.getTime() <= now)
        throw new Error("Expired token");
    return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt,
        externalAccountId: claims.sub,
    };
}
//# sourceMappingURL=magaluTokenResponse.js.map