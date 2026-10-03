"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MagaluHttpError = void 0;
exports.safeMagaluRequestId = safeMagaluRequestId;
exports.magaluRetryAfter = magaluRetryAfter;
exports.magaluHttpFailure = magaluHttpFailure;
exports.discardMagaluResponse = discardMagaluResponse;
const AppError_1 = require("../../errors/AppError");
class MagaluHttpError extends AppError_1.AppError {
    code;
    providerStatus;
    requestId;
    retryAfterMs;
    retryable;
    constructor(message, statusCode, code, providerStatus = null, requestId = null, retryAfterMs = null, retryable = false) {
        super(message, statusCode);
        this.code = code;
        this.providerStatus = providerStatus;
        this.requestId = requestId;
        this.retryAfterMs = retryAfterMs;
        this.retryable = retryable;
        this.name = "MagaluHttpError";
        Object.setPrototypeOf(this, MagaluHttpError.prototype);
    }
}
exports.MagaluHttpError = MagaluHttpError;
function safeMagaluRequestId(headers) {
    const value = headers.get("x-request-id");
    return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
function magaluRetryAfter(headers, now) {
    const raw = headers.get("retry-after")?.trim();
    if (!raw)
        return null;
    if (/^\d+$/.test(raw)) {
        const delay = Number(raw) * 1000;
        return Number.isSafeInteger(delay) ? delay : Number.MAX_SAFE_INTEGER;
    }
    const date = Date.parse(raw);
    return Number.isFinite(date) ? Math.max(0, date - now) : null;
}
function magaluHttpFailure(response, now, fallbackRequestId, refresh = false) {
    const status = response.status;
    const requestId = safeMagaluRequestId(response.headers) ?? fallbackRequestId;
    const retryAfter = magaluRetryAfter(response.headers, now);
    if (refresh && [400, 401, 403].includes(status)) {
        return new MagaluHttpError("A Magalu recusou a renovação. Verifique as credenciais ou conecte a conta novamente.", 409, "unauthorized", status, requestId);
    }
    switch (status) {
        case 400: return new MagaluHttpError("A Magalu recusou os parâmetros da requisição.", 400, "bad_request", status, requestId);
        case 401: return new MagaluHttpError("A autorização Magalu não é mais válida. Conecte a conta novamente.", 409, "unauthorized", status, requestId);
        case 403: return new MagaluHttpError("A conta Magalu não possui permissão para acessar este recurso.", 403, "forbidden", status, requestId);
        case 404: return new MagaluHttpError("O recurso solicitado não foi encontrado na Magalu.", 404, "not_found", status, requestId);
        case 429: return new MagaluHttpError("O limite de consultas da Magalu foi atingido. Aguarde antes de tentar novamente.", 429, "rate_limited", status, requestId, retryAfter, !refresh);
        case 500:
        case 502:
        case 503:
        case 504:
            return new MagaluHttpError("A Magalu está temporariamente indisponível. Tente novamente mais tarde.", 503, "unavailable", status, requestId, retryAfter, !refresh);
        default: return new MagaluHttpError("A Magalu não conseguiu atender a requisição.", 502, "invalid_response", status, requestId);
    }
}
async function discardMagaluResponse(response) {
    try {
        await response.body?.cancel();
    }
    catch { /* Nunca propagar erro de body externo. */ }
}
//# sourceMappingURL=magaluHttpError.js.map