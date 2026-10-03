import { AppError } from "../../errors/AppError";
export type MagaluFailureCode = "bad_request" | "unauthorized" | "forbidden" | "not_found" | "rate_limited" | "unavailable" | "network" | "timeout" | "cancelled" | "invalid_response" | "invalid_account" | "token_protection" | "token_persistence" | "account_changed";
export declare class MagaluHttpError extends AppError {
    readonly code: MagaluFailureCode;
    readonly providerStatus: number | null;
    readonly requestId: string | null;
    readonly retryAfterMs: number | null;
    readonly retryable: boolean;
    constructor(message: string, statusCode: number, code: MagaluFailureCode, providerStatus?: number | null, requestId?: string | null, retryAfterMs?: number | null, retryable?: boolean);
}
export declare function safeMagaluRequestId(headers: Headers): string | null;
export declare function magaluRetryAfter(headers: Headers, now: number): number | null;
export declare function magaluHttpFailure(response: Response, now: number, fallbackRequestId: string, refresh?: boolean): MagaluHttpError;
export declare function discardMagaluResponse(response: Response): Promise<void>;
//# sourceMappingURL=magaluHttpError.d.ts.map