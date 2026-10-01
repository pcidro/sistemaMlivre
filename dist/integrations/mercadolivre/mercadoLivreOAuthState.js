"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MERCADO_LIVRE_OAUTH_STATE_MAX_AGE = exports.MERCADO_LIVRE_OAUTH_STATE_COOKIE_PATH = exports.MERCADO_LIVRE_OAUTH_STATE_COOKIE = void 0;
exports.createMercadoLivreOAuthState = createMercadoLivreOAuthState;
exports.validateMercadoLivreOAuthState = validateMercadoLivreOAuthState;
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const STATE_DURATION_MILLISECONDS = 10 * 60 * 1000;
const STATE_SIGNATURE_CONTEXT = "mercado-livre-oauth-state";
exports.MERCADO_LIVRE_OAUTH_STATE_COOKIE = "ml_oauth_state";
exports.MERCADO_LIVRE_OAUTH_STATE_COOKIE_PATH = "/api/marketplace-accounts/mercadolivre/callback";
exports.MERCADO_LIVRE_OAUTH_STATE_MAX_AGE = STATE_DURATION_MILLISECONDS;
const statePayloadSchema = zod_1.z.object({
    state: zod_1.z.string().min(1),
    userId: zod_1.z.string().uuid(),
    expiresAt: zod_1.z.number().int().positive(),
});
function getStateSigningSecret() {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new AppError_1.AppError("Configuração de segurança OAuth ausente", 500);
    }
    return jwtSecret;
}
function createSignature(encodedPayload) {
    return (0, node_crypto_1.createHmac)("sha256", getStateSigningSecret())
        .update(`${STATE_SIGNATURE_CONTEXT}.${encodedPayload}`)
        .digest();
}
function safelyEquals(first, second) {
    const firstBuffer = Buffer.from(first, "utf8");
    const secondBuffer = Buffer.from(second, "utf8");
    return (firstBuffer.length === secondBuffer.length &&
        (0, node_crypto_1.timingSafeEqual)(firstBuffer, secondBuffer));
}
function invalidState() {
    throw new AppError_1.AppError("State OAuth inválido ou expirado", 400);
}
function createMercadoLivreOAuthState(userId) {
    const state = (0, node_crypto_1.randomBytes)(32).toString("base64url");
    const encodedPayload = Buffer.from(JSON.stringify({
        state,
        userId,
        expiresAt: Date.now() + STATE_DURATION_MILLISECONDS,
    }), "utf8").toString("base64url");
    const signature = createSignature(encodedPayload).toString("base64url");
    return {
        state,
        cookieValue: `${encodedPayload}.${signature}`,
    };
}
function validateMercadoLivreOAuthState(receivedState, cookieValue) {
    if (!cookieValue) {
        return invalidState();
    }
    const [encodedPayload, encodedSignature, ...extraParts] = cookieValue.split(".");
    if (!encodedPayload || !encodedSignature || extraParts.length > 0) {
        return invalidState();
    }
    const providedSignature = Buffer.from(encodedSignature, "base64url");
    const expectedSignature = createSignature(encodedPayload);
    if (providedSignature.length !== expectedSignature.length ||
        !(0, node_crypto_1.timingSafeEqual)(providedSignature, expectedSignature)) {
        return invalidState();
    }
    try {
        const payload = statePayloadSchema.parse(JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")));
        if (payload.expiresAt <= Date.now() ||
            !safelyEquals(payload.state, receivedState)) {
            return invalidState();
        }
        return { userId: payload.userId };
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            throw error;
        }
        return invalidState();
    }
}
//# sourceMappingURL=mercadoLivreOAuthState.js.map