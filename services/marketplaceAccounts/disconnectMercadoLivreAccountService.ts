import { AppError } from "../../errors/AppError";
import { MercadoLivreOAuthClient } from "../../integrations/mercadolivre/mercadoLivreOAuthClient";
import { MercadoLivreTokenService } from "../../integrations/mercadolivre/mercadoLivreTokenService";
import { prisma } from "../../lib/prisma";

interface OwnedAccount {
  id: string;
  externalAccountId: string;
}

interface DisconnectMercadoLivreAccountDependencies {
  findOwnedAccount?: (
    marketplaceAccountId: string,
    userId: string,
  ) => Promise<OwnedAccount | null>;
  getValidAccessToken?: (marketplaceAccountId: string) => Promise<string>;
  revokeAuthorization?: (
    externalAccountId: string,
    accessToken: string,
  ) => Promise<void>;
  clearCredentials?: (marketplaceAccountId: string) => Promise<void>;
}

export class DisconnectMercadoLivreAccountService {
  private readonly findOwnedAccount: NonNullable<
    DisconnectMercadoLivreAccountDependencies["findOwnedAccount"]
  >;
  private readonly getValidAccessToken: NonNullable<
    DisconnectMercadoLivreAccountDependencies["getValidAccessToken"]
  >;
  private readonly revokeAuthorization: NonNullable<
    DisconnectMercadoLivreAccountDependencies["revokeAuthorization"]
  >;
  private readonly clearCredentials: NonNullable<
    DisconnectMercadoLivreAccountDependencies["clearCredentials"]
  >;

  constructor(dependencies: DisconnectMercadoLivreAccountDependencies = {}) {
    const tokenService = new MercadoLivreTokenService();
    const oauthClient = new MercadoLivreOAuthClient();

    this.findOwnedAccount =
      dependencies.findOwnedAccount ??
      ((marketplaceAccountId, userId) =>
        prisma.marketplaceAccount.findFirst({
          where: {
            id: marketplaceAccountId,
            userId,
            platform: "MERCADO_LIVRE",
            isActive: true,
          },
          select: {
            id: true,
            externalAccountId: true,
          },
        }));
    this.getValidAccessToken =
      dependencies.getValidAccessToken ??
      ((marketplaceAccountId) =>
        tokenService.getValidAccessToken(marketplaceAccountId));
    this.revokeAuthorization =
      dependencies.revokeAuthorization ??
      ((externalAccountId, accessToken) =>
        oauthClient.revokeAuthorization(externalAccountId, accessToken));
    this.clearCredentials =
      dependencies.clearCredentials ??
      (async (marketplaceAccountId) => {
        await prisma.marketplaceAccount.update({
          where: { id: marketplaceAccountId },
          data: {
            accessTokenEncrypted: "",
            refreshTokenEncrypted: null,
            tokenExpiresAt: null,
            isActive: false,
          },
        });
      });
  }

  async execute(marketplaceAccountId: string, userId: string): Promise<void> {
    const account = await this.findOwnedAccount(marketplaceAccountId, userId);

    if (!account) {
      throw new AppError(
        "Conta do Mercado Livre não encontrada para este usuário",
        404,
      );
    }

    const accessToken = await this.getValidAccessToken(account.id);

    await this.revokeAuthorization(account.externalAccountId, accessToken);
    await this.clearCredentials(account.id);
  }
}
