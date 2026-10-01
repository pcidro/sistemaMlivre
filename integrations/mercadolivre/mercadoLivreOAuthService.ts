import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { encryptToken } from "../../utils/tokenEncryption";
import { MercadoLivreOAuthClient } from "./mercadoLivreOAuthClient";
import { createMercadoLivreOAuthState } from "./mercadoLivreOAuthState";

export class MercadoLivreOAuthService {
  constructor(
    private readonly oauthClient = new MercadoLivreOAuthClient(),
  ) {}

  createAuthorization(userId: string) {
    const stateSession = createMercadoLivreOAuthState(userId);

    return {
      authorizationUrl: this.oauthClient.getAuthorizationUrl(
        stateSession.state,
      ),
      stateCookieValue: stateSession.cookieValue,
    };
  }

  async completeAuthorization(code: string, initiatedByUserId: string) {
    const initiatingUser = await prisma.user.findUnique({
      where: { id: initiatedByUserId },
      select: { id: true },
    });

    if (!initiatingUser) {
      throw new AppError("Usuário que iniciou a conexão não encontrado", 401);
    }

    const tokens = await this.oauthClient.exchangeAuthorizationCode(code);
    const account = await this.oauthClient.getAuthenticatedAccount(
      tokens.accessToken,
    );

    if (account.externalAccountId !== tokens.userId) {
      throw new AppError(
        "A conta retornada pelo Mercado Livre não corresponde à autorização",
        502,
      );
    }

    const tokenExpiresAt = new Date(
      Date.now() + tokens.expiresInSeconds * 1000,
    );

    return prisma.marketplaceAccount.upsert({
      where: {
        platform_externalAccountId: {
          platform: "MERCADO_LIVRE",
          externalAccountId: account.externalAccountId,
        },
      },
      create: {
        platform: "MERCADO_LIVRE",
        name: account.name,
        cnpj: account.cnpj,
        externalAccountId: account.externalAccountId,
        accessTokenEncrypted: encryptToken(tokens.accessToken),
        refreshTokenEncrypted: encryptToken(tokens.refreshToken),
        tokenExpiresAt,
      },
      update: {
        name: account.name,
        cnpj: account.cnpj,
        accessTokenEncrypted: encryptToken(tokens.accessToken),
        refreshTokenEncrypted: encryptToken(tokens.refreshToken),
        tokenExpiresAt,
        isActive: true,
      },
      select: {
        id: true,
        platform: true,
        name: true,
        cnpj: true,
        externalAccountId: true,
        tokenExpiresAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
