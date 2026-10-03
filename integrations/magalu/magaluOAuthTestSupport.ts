import { createHash } from "node:crypto";
import { AppError } from "../../errors/AppError";
import { getMagaluOAuthConfig, MAGALU_OAUTH_SCOPES } from "./magaluOAuthConfig";
import type { MagaluOAuthStorage, PendingMagaluAuthorization, MagaluAccountAuthorization } from "./magaluOAuthStorage";

export const testUserId = "00000000-0000-4000-8000-000000000001";
export const otherUserId = "00000000-0000-4000-8000-000000000002";
export const tenantId = "GENPUB.00000000-0000-4000-8000-000000000003";
export const oauthTestEnv = {
  NODE_ENV: "development",
  MAGALU_CLIENT_ID: "client-ficticio",
  MAGALU_CLIENT_SECRET: "secret-ficticio",
  MAGALU_REDIRECT_URI: "https://sistemamlivre.onrender.com/api/marketplace-accounts/magalu/callback",
  MAGALU_AUTH_URL: "https://id.magalu.com",
  MAGALU_ENV: "sandbox",
};
export const oauthTestConfig = getMagaluOAuthConfig(oauthTestEnv);

export function tokenFixture(claims: Record<string, unknown> = {}) {
  const accessToken = [
    Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: tenantId, exp: Math.floor(Date.now() / 1000) + 7200,
      aud: "https://api-sandbox.magalu.com", ...claims })).toString("base64url"),
    Buffer.from("assinatura-ficticia-usada-apenas-em-testes").toString("base64url"),
  ].join(".");
  return {
    access_token: accessToken,
    refresh_token: "refresh-ficticio",
    expires_in: 7200,
    token_type: "Bearer",
    created_at: Math.floor(Date.now() / 1000),
    scope: MAGALU_OAUTH_SCOPES.join(" "),
  };
}

export class MemoryMagaluStorage implements MagaluOAuthStorage {
  states = new Map<string, PendingMagaluAuthorization>();
  accounts = new Map<string, MagaluAccountAuthorization>();
  users = new Set([testUserId, otherUserId]);
  async createState(state: PendingMagaluAuthorization) { this.states.set(state.stateHash, state); }
  async consumeState(hash: string, fingerprint: string, now: Date) {
    const state = this.states.get(hash);
    if (!state || state.expiresAt <= now || state.configFingerprint !== fingerprint) return null;
    this.states.delete(hash);
    return { userId: state.userId };
  }
  async userExists(id: string) { return this.users.has(id); }
  async saveAccount(account: MagaluAccountAuthorization) {
    const existing = this.accounts.get(account.externalAccountId);
    if (existing && existing.userId !== account.userId) throw new AppError("Esta conta Magalu já está vinculada a outro usuário", 409);
    this.accounts.set(account.externalAccountId, account);
  }
  findState(state: string) { return this.states.get(createHash("sha256").update(state).digest("hex")); }
}
