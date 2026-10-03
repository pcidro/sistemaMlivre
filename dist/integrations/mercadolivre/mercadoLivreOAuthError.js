"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoLivreOAuthError = void 0;
exports.readOAuthProviderError = readOAuthProviderError;
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const providerErrorSchema = zod_1.z.enum([
    "invalid_client",
    "invalid_grant",
    "invalid_scope",
    "invalid_request",
    "unsupported_grant_type",
    "invalid_operator_user_id",
    "access_denied",
    "forbidden",
    "local_rate_limited",
]);
class MercadoLivreOAuthError extends AppError_1.AppError {
    code;
    upstreamStatus;
    upstreamError;
    constructor(message, statusCode, code, upstream) {
        super(message, statusCode);
        this.code = code;
        this.name = "MercadoLivreOAuthError";
        this.upstreamStatus = upstream?.status ?? null;
        this.upstreamError = upstream?.error ?? null;
        Object.setPrototypeOf(this, MercadoLivreOAuthError.prototype);
    }
}
exports.MercadoLivreOAuthError = MercadoLivreOAuthError;
async function readOAuthProviderError(response) {
    // Somente códigos conhecidos: descrições e corpos podem conter credenciais.
    try {
        const result = zod_1.z.object({ error: providerErrorSchema }).safeParse(await response.json());
        return result.success ? result.data.error : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=mercadoLivreOAuthError.js.map