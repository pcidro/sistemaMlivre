import { decryptToken, encryptToken } from "../../utils/tokenEncryption";
import { MagaluOAuthClient } from "./magaluOAuthClient";
import type { MagaluOAuthConfig } from "./magaluOAuthConfig";
import { MagaluHttpError } from "./magaluHttpError";
import { readMagaluTokenClaims } from "./magaluTokenResponse";
import { magaluTokenStorage, type MagaluTokenAccount, type MagaluTokenStorage, type MagaluSavedTokens } from "./magaluTokenStorage";

interface PendingTokens {
  source: MagaluTokenAccount;
  tokens: MagaluSavedTokens;
}

/** Compartilhar uma instância entre clients para coordenar refresh e recuperação. */
export class MagaluTokenService {
  private readonly refreshes = new Map<string, Promise<MagaluSavedTokens | MagaluTokenAccount>>();
  private readonly pendingSaves = new Map<string, PendingTokens>();

  constructor(
    private readonly oauthClient = new MagaluOAuthClient(),
    private readonly storage: MagaluTokenStorage = magaluTokenStorage,
    private readonly now: () => number = Date.now,
  ) {}

  async getAccessToken(expected: MagaluTokenAccount, config: MagaluOAuthConfig, rejectedToken?: string): Promise<string> {
    const key = `${config.clientId}:${config.environment}:${expected.id}:${expected.userId}`;
    try {
      this.assertAccount(expected, expected);
      const account = await this.storage.findAccount(expected.id);
      this.assertAccount(account, expected);
      const startedWhileReading = this.refreshes.get(key);
      if (startedWhileReading) return this.decrypt((await startedWhileReading).accessTokenEncrypted);
      const accessToken = this.decrypt(account.accessTokenEncrypted);
      if (!this.pendingSaves.has(key) && this.usable(account, accessToken, config, rejectedToken)) return accessToken;

      const refresh = this.refresh(expected, config, key, rejectedToken);
      this.refreshes.set(key, refresh);
      try { return this.decrypt((await refresh).accessTokenEncrypted); }
      finally { if (this.refreshes.get(key) === refresh) this.refreshes.delete(key); }
    } catch (error) {
      if (error instanceof MagaluHttpError) throw error;
      throw new MagaluHttpError("Não foi possível carregar ou salvar os tokens Magalu. Tente novamente.", 503, "token_persistence");
    }
  }

  private async refresh(expected: MagaluTokenAccount, config: MagaluOAuthConfig, key: string, rejectedToken?: string) {
    const result = await this.storage.withLockedAccount(expected.id, async (account, save) => {
      this.assertAccount(account, expected);
      const pending = this.pendingSaves.get(key);
      if (pending) {
        if (this.sameTokens(account, pending.tokens)) return pending.tokens; // Commit pode ter ocorrido antes da falha de comunicação.
        if (this.sameTokens(account, pending.source)) {
          await save(pending.tokens); // Recuperar sem enviar novamente o refresh antigo.
          return pending.tokens;
        }
        this.pendingSaves.delete(key); // Reconexão ou mudança externa: nunca sobrescrever novos tokens.
      }
      const accessToken = this.decrypt(account.accessTokenEncrypted);
      if (this.usable(account, accessToken, config, rejectedToken)) return account;
      if (!account.refreshTokenEncrypted) {
        throw new MagaluHttpError("A conta Magalu precisa ser conectada novamente para renovar a autorização.", 409, "unauthorized");
      }
      const refreshed = await this.oauthClient.refreshAccessToken(this.decrypt(account.refreshTokenEncrypted), config);
      if (refreshed.externalAccountId !== account.externalAccountId) {
        throw new MagaluHttpError("O ID Magalu retornou credenciais de outra conta.", 502, "invalid_response");
      }
      const tokens = {
        accessTokenEncrypted: encryptToken(refreshed.accessToken),
        refreshTokenEncrypted: refreshed.refreshToken ? encryptToken(refreshed.refreshToken) : account.refreshTokenEncrypted,
        tokenExpiresAt: refreshed.tokenExpiresAt,
      };
      // Reter o resultado criptografado antes de salvar. Se UPDATE/COMMIT falhar,
      // a próxima chamada tenta persistir o mesmo resultado sem repetir OAuth.
      this.pendingSaves.set(key, { source: account, tokens });
      await save(tokens);
      return tokens;
    });
    // withLockedAccount só retorna após COMMIT; o token novo só pode ser utilizado depois dele.
    this.pendingSaves.delete(key);
    return result;
  }

  private usable(account: MagaluTokenAccount, accessToken: string, config: MagaluOAuthConfig, rejectedToken?: string) {
    let claims: ReturnType<typeof readMagaluTokenClaims>;
    try { claims = readMagaluTokenClaims(accessToken, config.audience); }
    catch { throw new MagaluHttpError("Os tokens Magalu não correspondem ao ambiente configurado. Conecte a conta novamente.", 409, "unauthorized"); }
    if (claims.sub !== account.externalAccountId) throw new MagaluHttpError("As credenciais Magalu não correspondem à conta.", 409, "unauthorized");
    const expiry = Math.min(account.tokenExpiresAt?.getTime() ?? Number.NEGATIVE_INFINITY, claims.exp * 1000);
    return expiry > this.now() + 60_000 && accessToken !== rejectedToken;
  }

  private assertAccount(account: MagaluTokenAccount | null, expected: MagaluTokenAccount): asserts account is MagaluTokenAccount {
    if (!account || account.platform !== "MAGALU" || !account.isActive || !account.userId ||
        account.id !== expected.id || account.userId !== expected.userId || account.externalAccountId !== expected.externalAccountId) {
      throw new MagaluHttpError("Conta Magalu não encontrada, inativa ou sem acesso autorizado.", 404, "invalid_account");
    }
  }

  private decrypt(value: string) {
    try { return decryptToken(value); }
    catch { throw new MagaluHttpError("Não foi possível acessar os tokens protegidos da Magalu. Verifique a configuração de criptografia.", 500, "token_protection"); }
  }

  private sameTokens(account: MagaluTokenAccount, other: Pick<MagaluTokenAccount, "accessTokenEncrypted" | "refreshTokenEncrypted">) {
    return account.accessTokenEncrypted === other.accessTokenEncrypted && account.refreshTokenEncrypted === other.refreshTokenEncrypted;
  }
}

export const magaluTokenService = new MagaluTokenService();
