import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { decryptToken, encryptToken } from "../../utils/tokenEncryption";
import { MercadoLivreOAuthClient } from "./mercadoLivreOAuthClient";

const TOKEN_EXPIRATION_MARGIN_MILLISECONDS = 60 * 1000;

export class MercadoLivreTokenService {
  constructor(
    private readonly oauthClient = new MercadoLivreOAuthClient(),
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

    await prisma.marketplaceAccount.update({
      where: { id: account.id },
      data: {
        accessTokenEncrypted: encryptToken(tokens.accessToken),
        refreshTokenEncrypted: encryptToken(tokens.refreshToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000),
      },
    });

    return tokens.accessToken;
  }

  private async getAccountCredentials(marketplaceAccountId: string) {
    const account = await prisma.marketplaceAccount.findUnique({
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
