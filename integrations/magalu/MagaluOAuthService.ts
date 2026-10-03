import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../errors/AppError";
import { encryptToken, TokenEncryptionConfigurationError } from "../../utils/tokenEncryption";
import { MagaluOAuthClient } from "./magaluOAuthClient";
import { getMagaluOAuthConfig, magaluOAuthConfigFingerprint, type MagaluOAuthConfig } from "./magaluOAuthConfig";
import { magaluOAuthStorage, type MagaluOAuthStorage } from "./magaluOAuthStorage";

export const MAGALU_STATE_COOKIE = "magalu_oauth_state";
export const MAGALU_STATE_COOKIE_PATH = "/api/marketplace-accounts/magalu/callback";
export const MAGALU_STATE_MAX_AGE = 10 * 60 * 1000;
const statePattern = /^[a-f0-9]{64}$/;

export class MagaluOAuthService {
  constructor(
    private readonly client = new MagaluOAuthClient(),
    private readonly storage: MagaluOAuthStorage = magaluOAuthStorage,
    private readonly getConfig: () => MagaluOAuthConfig = getMagaluOAuthConfig,
  ) {}

  async createAuthorization(userId: string) {
    try {
      const config = this.getConfig();
      if (!z.string().uuid().safeParse(userId).success || !await this.storage.userExists(userId)) {
        throw new AppError("Usuário que iniciou a conexão não encontrado", 401);
      }
      const state = randomBytes(32).toString("hex");
      await this.storage.createState({
        stateHash: this.hashState(state), userId,
        configFingerprint: magaluOAuthConfigFingerprint(config),
        expiresAt: new Date(Date.now() + MAGALU_STATE_MAX_AGE),
      });
      return { authorizationUrl: this.client.getAuthorizationUrl(state, config), stateCookieValue: state };
    } catch (error) {
      throw this.safeError(error);
    }
  }

  async completeAuthorization(query: { state: string; code?: string; error?: string }, cookieValue: string | undefined): Promise<void> {
    try {
      const { state, code, error } = query;
      if (!statePattern.test(state) || !cookieValue || !statePattern.test(cookieValue) ||
          !timingSafeEqual(Buffer.from(state), Buffer.from(cookieValue))) {
        throw new AppError("State OAuth inválido ou expirado. Inicie uma nova conexão.", 400);
      }
      const config = this.getConfig();
      const session = await this.storage.consumeState(this.hashState(state), magaluOAuthConfigFingerprint(config), new Date());
      if (!session) throw new AppError("State OAuth inválido, expirado ou já utilizado. Inicie uma nova conexão.", 400);
      if (error) throw new AppError("A autorização Magalu não foi concedida. Inicie uma nova conexão.", 400);
      if (!code) throw new AppError("Código de autorização Magalu ausente", 400);
      if (!await this.storage.userExists(session.userId)) throw new AppError("Usuário que iniciou a conexão não encontrado", 401);

      const tokens = await this.client.exchangeAuthorizationCode(code, config);
      await this.storage.saveAccount({
        userId: session.userId,
        externalAccountId: tokens.externalAccountId,
        accessTokenEncrypted: encryptToken(tokens.accessToken),
        refreshTokenEncrypted: encryptToken(tokens.refreshToken),
        tokenExpiresAt: tokens.tokenExpiresAt,
      });
    } catch (error) {
      throw this.safeError(error);
    }
  }

  private hashState(state: string) { return createHash("sha256").update(state).digest("hex"); }

  private safeError(error: unknown): AppError {
    if (error instanceof AppError) return error;
    if (error instanceof TokenEncryptionConfigurationError) {
      return new AppError("Configuração de proteção dos tokens inválida", 500);
    }
    return new AppError("Não foi possível salvar a autorização Magalu. Inicie uma nova conexão.", 500);
  }
}
