import { z } from "zod";
import { AppError } from "../../errors/AppError";
export type MercadoLivreOAuthFailureCode = "state_missing" | "state_invalid" | "authorization_denied" | "callback_invalid" | "oauth_configuration" | "token_exchange_failed" | "account_lookup_failed" | "account_mismatch" | "user_not_found" | "account_already_linked" | "encryption_configuration" | "persistence_failed" | "unexpected";
declare const providerErrorSchema: z.ZodEnum<{
    access_denied: "access_denied";
    forbidden: "forbidden";
    invalid_client: "invalid_client";
    invalid_grant: "invalid_grant";
    invalid_operator_user_id: "invalid_operator_user_id";
    invalid_request: "invalid_request";
    invalid_scope: "invalid_scope";
    local_rate_limited: "local_rate_limited";
    unsupported_grant_type: "unsupported_grant_type";
}>;
type ProviderError = z.infer<typeof providerErrorSchema>;
export declare class MercadoLivreOAuthError extends AppError {
    readonly code: MercadoLivreOAuthFailureCode;
    readonly upstreamStatus: number | null;
    readonly upstreamError: ProviderError | null;
    constructor(message: string, statusCode: number, code: MercadoLivreOAuthFailureCode, upstream?: {
        status: number;
        error: ProviderError | null;
    });
}
export declare function readOAuthProviderError(response: Response): Promise<ProviderError | null>;
export {};
//# sourceMappingURL=mercadoLivreOAuthError.d.ts.map