"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoLivreOAuthController = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const mercadoLivreOAuthService_1 = require("../../integrations/mercadolivre/mercadoLivreOAuthService");
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
function frontendRedirectUrl(status) {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
        throw new AppError_1.AppError("FRONTEND_URL não configurada", 500);
    }
    const redirectUrl = new URL(frontendUrl);
    redirectUrl.searchParams.set("mercadolivre", status);
    return redirectUrl.toString();
}
class MercadoLivreOAuthController {
    async connect(req, res) {
        const oauthService = new mercadoLivreOAuthService_1.MercadoLivreOAuthService();
        const authorization = oauthService.createAuthorization(req.user_id);
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
                throw new AppError_1.AppError("Autorização do Mercado Livre não concluída", 400);
            }
            const { code } = callbackQuerySchema.parse(req.query);
            const oauthService = new mercadoLivreOAuthService_1.MercadoLivreOAuthService();
            await oauthService.completeAuthorization(code, userId);
            return res.redirect(frontendRedirectUrl("success"));
        }
        catch {
            return res.redirect(frontendRedirectUrl("error"));
        }
    }
}
exports.MercadoLivreOAuthController = MercadoLivreOAuthController;
//# sourceMappingURL=mercadoLivreOAuthController.js.map