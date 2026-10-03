import { z } from "zod";

import { AppError } from "../../errors/AppError";

export type MercadoLivreOAuthFailureCode =
  | "state_missing"
  | "state_invalid"
  | "authorization_denied"
  | "callback_invalid"
  | "oauth_configuration"
  | "token_exchange_failed"
  | "account_lookup_failed"
  | "account_mismatch"
  | "user_not_found"
  | "account_already_linked"
  | "encryption_configuration"
  | "persistence_failed"
  | "unexpected";

const providerErrorSchema = z.enum([
  "invalid_client",
  "invalid_grant",
  "invalid_scope",
  "invalid_request",
  "unsupported_grant_type",
  "unauthorized_client",
  "unauthorized_application",
  "invalid_operator_user_id",
  "access_denied",
  "forbidden",
  "local_rate_limited",
]);

type ProviderError = z.infer<typeof providerErrorSchema>;

export class MercadoLivreOAuthError extends AppError {
  readonly upstreamStatus: number | null;
  readonly upstreamError: ProviderError | null;

  constructor(
    message: string,
    statusCode: number,
    readonly code: MercadoLivreOAuthFailureCode,
    upstream?: { status: number; error: ProviderError | null },
  ) {
    super(message, statusCode);
    this.name = "MercadoLivreOAuthError";
    this.upstreamStatus = upstream?.status ?? null;
    this.upstreamError = upstream?.error ?? null;
    Object.setPrototypeOf(this, MercadoLivreOAuthError.prototype);
  }
}

export async function readOAuthProviderError(response: Response): Promise<ProviderError | null> {
  // Somente códigos conhecidos: descrições e corpos podem conter credenciais.
  try {
    const result = z.object({ error: providerErrorSchema }).safeParse(await response.json());
    return result.success ? result.data.error : null;
  } catch {
    return null;
  }
}
