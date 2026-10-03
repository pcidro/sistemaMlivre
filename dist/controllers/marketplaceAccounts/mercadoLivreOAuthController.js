"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoLivreOAuthController = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const mercadoLivreOAuthService_1 = require("../../integrations/mercadolivre/mercadoLivreOAuthService");
const mercadoLivreOAuthError_1 = require("../../integrations/mercadolivre/mercadoLivreOAuthError");
const mercadoLivreOAuthState_1 = require("../../integrations/mercadolivre/mercadoLivreOAuthState");
const callbackQuerySchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    state: zod_1.z.string().min(1),
});
function readCookie(req, name) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader)
        return undefined;
    for (const cookie of cookieHeader.split(";")) {
        const [cookieName, ...valueParts] = cookie.trim().split("=");
        if (cookieName === name) {
            try {
                return decodeURIComponent(valueParts.join("="));
            }
            catch {
                return undefined;
            }
        }
    }
    return undefined;
}
function stateCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: mercadoLivreOAuthState_1.MERCADO_LIVRE_OAUTH_STATE_COOKIE_PATH,
    };
}
function frontendRedirectUrl(status, reason) {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
        throw new AppError_1.AppError("FRONTEND_URL não configurada", 500);
    }
    const redirectUrl = new URL(frontendUrl);
    redirectUrl.searchParams.set("mercadolivre", status);
    redirectUrl.searchParams.delete("mercadolivre_error");
    if (reason)
        redirectUrl.searchParams.set("mercadolivre_error", reason);
    return redirectUrl.toString();
}
class MercadoLivreOAuthController {
    oauthService;
    constructor(oauthService = new mercadoLivreOAuthService_1.MercadoLivreOAuthService()) {
        this.oauthService = oauthService;
    }
    async connect(req, res) {
        const authorization = this.oauthService.createAuthorization(req.user_id);
        res.cookie(mercadoLivreOAuthState_1.MERCADO_LIVRE_OAUTH_STATE_COOKIE, authorization.stateCookieValue, {
            ...stateCookieOptions(),
            maxAge: mercadoLivreOAuthState_1.MERCADO_LIVRE_OAUTH_STATE_MAX_AGE,
        });
        return res.redirect(authorization.authorizationUrl);
    }
    async callback(req, res) {
        try {
            const receivedState = typeof req.query.state === "string" ? req.query.state : "";
            const stateCookie = readCookie(req, mercadoLivreOAuthState_1.MERCADO_LIVRE_OAUTH_STATE_COOKIE);
            res.clearCookie(mercadoLivreOAuthState_1.MERCADO_LIVRE_OAUTH_STATE_COOKIE, stateCookieOptions());
            const { userId } = (0, mercadoLivreOAuthState_1.validateMercadoLivreOAuthState)(receivedState, stateCookie);
            if (typeof req.query.error === "string") {
                throw new mercadoLivreOAuthError_1.MercadoLivreOAuthError("Autorização do Mercado Livre não concluída", 400, "authorization_denied");
            }
            const query = callbackQuerySchema.safeParse(req.query);
            if (!query.success) {
                throw new mercadoLivreOAuthError_1.MercadoLivreOAuthError("Retorno de autorização inválido", 400, "callback_invalid");
            }
            await this.oauthService.completeAuthorization(query.data.code, userId);
            return res.redirect(frontendRedirectUrl("success"));
        }
        catch (error) {
            const reason = error instanceof mercadoLivreOAuthError_1.MercadoLivreOAuthError ? error.code : "unexpected";
            // Não registrar o erro bruto: query, mensagens e stack podem conter tokens.
            console.error("mercadolivre_oauth_callback_failed", {
                reason,
                upstreamStatus: error instanceof mercadoLivreOAuthError_1.MercadoLivreOAuthError ? error.upstreamStatus : null,
                upstreamError: error instanceof mercadoLivreOAuthError_1.MercadoLivreOAuthError ? error.upstreamError : null,
            });
            return res.redirect(frontendRedirectUrl("error", reason));
        }
    }
}
exports.MercadoLivreOAuthController = MercadoLivreOAuthController;
//# sourceMappingURL=mercadoLivreOAuthController.js.map