"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryMagaluStorage = exports.oauthTestConfig = exports.oauthTestEnv = exports.tenantId = exports.otherUserId = exports.testUserId = void 0;
exports.tokenFixture = tokenFixture;
const node_crypto_1 = require("node:crypto");
const AppError_1 = require("../../errors/AppError");
const magaluOAuthConfig_1 = require("./magaluOAuthConfig");
exports.testUserId = "00000000-0000-4000-8000-000000000001";
exports.otherUserId = "00000000-0000-4000-8000-000000000002";
exports.tenantId = "GENPUB.00000000-0000-4000-8000-000000000003";
exports.oauthTestEnv = {
    NODE_ENV: "development",
    MAGALU_CLIENT_ID: "client-ficticio",
    MAGALU_CLIENT_SECRET: "secret-ficticio",
    MAGALU_REDIRECT_URI: "https://sistemamlivre.onrender.com/api/marketplace-accounts/magalu/callback",
    MAGALU_AUTH_URL: "https://id.magalu.com",
    MAGALU_ENV: "sandbox",
};
exports.oauthTestConfig = (0, magaluOAuthConfig_1.getMagaluOAuthConfig)(exports.oauthTestEnv);
function tokenFixture(claims = {}) {
    const accessToken = [
        Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url"),
        Buffer.from(JSON.stringify({ sub: exports.tenantId, exp: Math.floor(Date.now() / 1000) + 7200,
            aud: "https://api-sandbox.magalu.com", ...claims })).toString("base64url"),
        Buffer.from("assinatura-ficticia-usada-apenas-em-testes").toString("base64url"),
    ].join(".");
    return {
        access_token: accessToken,
        refresh_token: "refresh-ficticio",
        expires_in: 7200,
        token_type: "Bearer",
        created_at: Math.floor(Date.now() / 1000),
        scope: magaluOAuthConfig_1.MAGALU_OAUTH_SCOPES.join(" "),
    };
}
class MemoryMagaluStorage {
    states = new Map();
    accounts = new Map();
    users = new Set([exports.testUserId, exports.otherUserId]);
    async createState(state) { this.states.set(state.stateHash, state); }
    async consumeState(hash, fingerprint, now) {
        const state = this.states.get(hash);
        if (!state || state.expiresAt <= now || state.configFingerprint !== fingerprint)
            return null;
        this.states.delete(hash);
        return { userId: state.userId };
    }
    async userExists(id) { return this.users.has(id); }
    async saveAccount(account) {
        const existing = this.accounts.get(account.externalAccountId);
        if (existing && existing.userId !== account.userId)
            throw new AppError_1.AppError("Esta conta Magalu já está vinculada a outro usuário", 409);
        this.accounts.set(account.externalAccountId, account);
    }
    findState(state) { return this.states.get((0, node_crypto_1.createHash)("sha256").update(state).digest("hex")); }
}
exports.MemoryMagaluStorage = MemoryMagaluStorage;
//# sourceMappingURL=magaluOAuthTestSupport.js.map