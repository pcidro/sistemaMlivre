import { prisma } from "../../lib/prisma";
import type { MarketplaceAccount, Prisma } from "../../generated/prisma/client";
import { encryptToken, TokenEncryptionConfigurationError } from "../../utils/tokenEncryption";
import { MercadoLivreOAuthClient } from "./mercadoLivreOAuthClient";
import { MercadoLivreOAuthError } from "./mercadoLivreOAuthError";
import { createMercadoLivreOAuthState } from "./mercadoLivreOAuthState";

type ConnectedAccount = Pick<MarketplaceAccount,
  "id" | "platform" | "name" | "cnpj" | "externalAccountId" | "tokenExpiresAt" | "isActive" | "createdAt" | "updatedAt"
>;

interface OAuthAccountStorage {
  findUser(userId: string): Promise<{ id: string } | null>;
  findAccount(externalAccountId: string): Promise<{ userId: string | null } | null>;
  saveAccount(data: Prisma.MarketplaceAccountUpsertArgs): Promise<ConnectedAccount>;
}

const accountStorage: OAuthAccountStorage = {
  findUser: (id) => prisma.user.findUnique({ where: { id }, select: { id: true } }),
  findAccount: (externalAccountId) => prisma.marketplaceAccount.findUnique({
    where: { platform_externalAccountId: { platform: "MERCADO_LIVRE", externalAccountId } },
    select: { userId: true },
  }),
  saveAccount: (data) => prisma.marketplaceAccount.upsert(data),
};

export class MercadoLivreOAuthService {
  constructor(
    private readonly oauthClient = new MercadoLivreOAuthClient(),
    private readonly storage: OAuthAccountStorage = accountStorage,
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
    try {
      return await this.connectAccount(code, initiatedByUserId);
    } catch (error) {
      if (error instanceof MercadoLivreOAuthError) throw error;
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new MercadoLivreOAuthError("Esta conta do Mercado Livre já pertence a outro usuário", 409, "account_already_linked");
      }
      if (error instanceof TokenEncryptionConfigurationError) {
        throw new MercadoLivreOAuthError(
          "Configuração de proteção dos tokens inválida",
          500,
          "encryption_configuration",
        );
      }
      throw new MercadoLivreOAuthError(
        "Não foi possível salvar a conexão do Mercado Livre",
        500,
        "persistence_failed",
      );
    }
  }

  private async connectAccount(code: string, initiatedByUserId: string) {
    const initiatingUser = await this.storage.findUser(initiatedByUserId);

    if (!initiatingUser) {
      throw new MercadoLivreOAuthError("Usuário que iniciou a conexão não encontrado", 401, "user_not_found");
    }

    const tokens = await this.oauthClient.exchangeAuthorizationCode(code);
    const account = await this.oauthClient.getAuthenticatedAccount(
      tokens.accessToken,
    );

    if (account.externalAccountId !== tokens.userId) {
      throw new MercadoLivreOAuthError(
        "A conta retornada pelo Mercado Livre não corresponde à autorização",
        502,
        "account_mismatch",
      );
    }

    const tokenExpiresAt = new Date(
      Date.now() + tokens.expiresInSeconds * 1000,
    );

    const existingAccount = await this.storage.findAccount(account.externalAccountId);

    if (
      existingAccount?.userId &&
      existingAccount.userId !== initiatedByUserId
    ) {
      throw new MercadoLivreOAuthError(
        "Esta conta do Mercado Livre já pertence a outro usuário",
        409,
        "account_already_linked",
      );
    }

    const accessTokenEncrypted = encryptToken(tokens.accessToken);
    const refreshTokenEncrypted = encryptToken(tokens.refreshToken);

    return this.storage.saveAccount({
      where: {
        // Revalida o dono na escrita, inclusive em callbacks concorrentes.
        OR: [{ userId: initiatedByUserId }, { userId: null }],
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
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt,
        userId: initiatedByUserId,
      },
      update: {
        name: account.name,
        cnpj: account.cnpj,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt,
        isActive: true,
        userId: initiatedByUserId,
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
