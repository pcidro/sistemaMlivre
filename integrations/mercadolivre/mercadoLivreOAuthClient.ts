import { z } from "zod";

import { AppError } from "../../errors/AppError";
import { getMercadoLivreConfig } from "./mercadoLivreConfig";
import { MercadoLivreOAuthError, readOAuthProviderError } from "./mercadoLivreOAuthError";

const MERCADO_LIVRE_AUTHORIZATION_URL =
  "https://auth.mercadolivre.com.br/authorization";
const MERCADO_LIVRE_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const MERCADO_LIVRE_CURRENT_USER_URL =
  "https://api.mercadolibre.com/users/me";
const MERCADO_LIVRE_API_BASE_URL = "https://api.mercadolibre.com";

const externalIdSchema = z.union([z.string().min(1), z.number().int().positive()]);

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  user_id: externalIdSchema,
});

const accountResponseSchema = z.object({
  id: externalIdSchema,
  nickname: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  identification: z
    .object({
      type: z.string().nullable().optional(),
      number: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  company: z
    .object({
      brand_name: z.string().nullable().optional(),
      corporate_name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export interface MercadoLivreTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  userId: string;
}

export interface MercadoLivreAuthenticatedAccount {
  externalAccountId: string;
  name: string;
  cnpj: string | null;
}

type FetchFunction = typeof globalThis.fetch;

function normalizeExternalId(value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new AppError(
        "O Mercado Livre retornou um identificador de conta inválido",
        502,
      );
    }

    return String(value);
  }

  if (!/^\d+$/.test(value)) {
    throw new AppError(
      "O Mercado Livre retornou um identificador de conta inválido",
      502,
    );
  }

  return value;
}

function resolveAccountName(
  account: z.infer<typeof accountResponseSchema>,
  externalAccountId: string,
): string {
  const fullName = [account.first_name, account.last_name]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .trim();

  return (
    account.company?.brand_name?.trim() ||
    account.company?.corporate_name?.trim() ||
    account.nickname?.trim() ||
    fullName ||
    `Mercado Livre ${externalAccountId}`
  );
}

export class MercadoLivreOAuthClient {
  constructor(private readonly fetchFn: FetchFunction = globalThis.fetch) {}

  getAuthorizationUrl(state: string): string {
    const config = getMercadoLivreConfig();
    const url = new URL(MERCADO_LIVRE_AUTHORIZATION_URL);

    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("state", state);

    return url.toString();
  }

  async exchangeAuthorizationCode(code: string): Promise<MercadoLivreTokenSet> {
    const config = getMercadoLivreConfig();

    return this.requestToken(
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
    );
  }

  async refreshAccessToken(refreshToken: string): Promise<MercadoLivreTokenSet> {
    const config = getMercadoLivreConfig();

    return this.requestToken(
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
      }),
    );
  }

  async getAuthenticatedAccount(
    accessToken: string,
  ): Promise<MercadoLivreAuthenticatedAccount> {
    let response: Response;

    try {
      response = await this.fetchFn(MERCADO_LIVRE_CURRENT_USER_URL, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch {
      throw new MercadoLivreOAuthError(
        "Não foi possível consultar a conta do Mercado Livre",
        502,
        "account_lookup_failed",
      );
    }

    if (!response.ok) {
      throw new MercadoLivreOAuthError(
        "O Mercado Livre recusou a consulta da conta autenticada",
        502,
        "account_lookup_failed",
        { status: response.status, error: await readOAuthProviderError(response) },
      );
    }

    try {
      const account = accountResponseSchema.parse(await response.json());
      const externalAccountId = normalizeExternalId(account.id);
      const identificationType = account.identification?.type?.toUpperCase();

      return {
        externalAccountId,
        name: resolveAccountName(account, externalAccountId),
        cnpj:
          identificationType === "CNPJ"
            ? (account.identification?.number ?? null)
            : null,
      };
    } catch {
      throw new MercadoLivreOAuthError(
        "O Mercado Livre retornou dados de conta inválidos",
        502,
        "account_lookup_failed",
        { status: response.status, error: null },
      );
    }
  }

  async revokeAuthorization(
    externalAccountId: string,
    accessToken: string,
  ): Promise<void> {
    const config = getMercadoLivreConfig();
    const url = new URL(
      `${MERCADO_LIVRE_API_BASE_URL}/users/${encodeURIComponent(externalAccountId)}/applications/${encodeURIComponent(config.clientId)}`,
    );
    let response: Response;

    try {
      response = await this.fetchFn(url, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch {
      throw new AppError(
        "Não foi possível revogar a autorização no Mercado Livre",
        503,
      );
    }

    if (!response.ok) {
      throw new AppError(
        "O Mercado Livre não permitiu revogar a autorização da conta",
        response.status === 429 ? 429 : 502,
      );
    }
  }

  private async requestToken(body: URLSearchParams): Promise<MercadoLivreTokenSet> {
    let response: Response;

    try {
      response = await this.fetchFn(MERCADO_LIVRE_TOKEN_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
    } catch {
      throw new MercadoLivreOAuthError(
        "Não foi possível comunicar com a autenticação do Mercado Livre",
        502,
        "token_exchange_failed",
      );
    }

    if (!response.ok) {
      throw new MercadoLivreOAuthError(
        "O Mercado Livre recusou a autenticação da conta",
        502,
        "token_exchange_failed",
        { status: response.status, error: await readOAuthProviderError(response) },
      );
    }

    try {
      const token = tokenResponseSchema.parse(await response.json());

      return {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresInSeconds: token.expires_in,
        userId: normalizeExternalId(token.user_id),
      };
    } catch {
      throw new MercadoLivreOAuthError(
        "O Mercado Livre retornou credenciais OAuth inválidas",
        502,
        "token_exchange_failed",
        { status: response.status, error: null },
      );
    }
  }
}
