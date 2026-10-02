import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { decryptToken, encryptToken } from "../../utils/tokenEncryption";
import { MercadoLivreOAuthClient } from "./mercadoLivreOAuthClient";

const TOKEN_EXPIRATION_MARGIN_MILLISECONDS = 60 * 1000;

interface AccountCredentials {
  id: string;
  platform: string;
  externalAccountId: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;
  isActive: boolean;
}

interface SavedCredentials {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: Date;
}

interface TokenServiceDependencies {
  findAccount?: (id: string) => Promise<AccountCredentials | null>;
  saveCredentials?: (id: string, credentials: SavedCredentials) => Promise<void>;
}

export class MercadoLivreTokenService {
  private readonly refreshes = new Map<string, Promise<string>>();
  constructor(
    private readonly oauthClient = new MercadoLivreOAuthClient(),
    private readonly dependencies: TokenServiceDependencies = {},
  ) {}

  async getValidAccessToken(marketplaceAccountId: string): Promise<string> {
    const account = await this.getAccountCredentials(marketplaceAccountId);
    const validUntil =
      account.tokenExpiresAt?.getTime() ?? Number.NEGATIVE_INFINITY;

    if (validUntil > Date.now() + TOKEN_EXPIRATION_MARGIN_MILLISECONDS) {
      return decryptToken(account.accessTokenEncrypted);
    }

    return this.refreshAccessToken(marketplaceAccountId);
  }

  async refreshAccessToken(marketplaceAccountId: string): Promise<string> {
    const pending = this.refreshes.get(marketplaceAccountId);
    if (pending) return pending;
    const refresh = this.performRefresh(marketplaceAccountId);
    this.refreshes.set(marketplaceAccountId, refresh);
    try {
      return await refresh;
    } finally {
      this.refreshes.delete(marketplaceAccountId);
    }
  }

  private async performRefresh(marketplaceAccountId: string): Promise<string> {
    const account = await this.getAccountCredentials(marketplaceAccountId);

    if (!account.refreshTokenEncrypted) {
      throw new AppError(
        "A conta do Mercado Livre precisa ser conectada novamente",
        409,
      );
    }

    const refreshToken = decryptToken(account.refreshTokenEncrypted);
    const tokens = await this.oauthClient.refreshAccessToken(refreshToken);

    if (tokens.userId !== account.externalAccountId) {
      throw new AppError(
        "O Mercado Livre retornou credenciais de outra conta",
        502,
      );
    }

    const credentials: SavedCredentials = {
      accessTokenEncrypted: encryptToken(tokens.accessToken),
      refreshTokenEncrypted: encryptToken(tokens.refreshToken),
      tokenExpiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000),
    };
    if (this.dependencies.saveCredentials) {
      await this.dependencies.saveCredentials(account.id, credentials);
    } else {
      await prisma.marketplaceAccount.update({ where: { id: account.id }, data: credentials });
    }

    return tokens.accessToken;
  }

  private async getAccountCredentials(marketplaceAccountId: string) {
    const account = this.dependencies.findAccount
      ? await this.dependencies.findAccount(marketplaceAccountId)
      : await prisma.marketplaceAccount.findUnique({
      where: { id: marketplaceAccountId },
      select: {
        id: true,
        platform: true,
        externalAccountId: true,
        accessTokenEncrypted: true,
        refreshTokenEncrypted: true,
        tokenExpiresAt: true,
        isActive: true,
      },
    });

    if (
      !account ||
      account.platform !== "MERCADO_LIVRE" ||
      !account.isActive
    ) {
      throw new AppError("Conta do Mercado Livre não encontrada ou inativa", 404);
    }

    return account;
  }
}
