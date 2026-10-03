"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MagaluCallbackController = void 0;
exports.sendMagaluCallbackResponse = sendMagaluCallbackResponse;
const magaluCallbackSchemas_1 = require("../../schemas/magaluCallbackSchemas");
const AppError_1 = require("../../errors/AppError");
const MagaluOAuthService_1 = require("../../integrations/magalu/MagaluOAuthService");
function sendMagaluCallbackResponse(res, status, message, connected = false) {
    if (res.req.accepts(["html", "json"]) === "json") {
        return res.status(status).json({ status: connected ? "connected" : "not_connected", message });
    }
    const escapedMessage = message.replace(/[&<>"']/g, (value) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[value]);
    return res.status(status).type("html").send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Conexão Magalu | LJ Fontes</title></head><body><main><h1>Conexão Magalu</h1><p>${escapedMessage}</p><p>Você pode fechar esta página.</p></main></body></html>`);
}
class MagaluCallbackController {
    service;
    constructor(service = new MagaluOAuthService_1.MagaluOAuthService()) {
        this.service = service;
    }
    async connect(req, res) {
        try {
            const authorization = await this.service.createAuthorization(req.user_id);
            res.cookie(MagaluOAuthService_1.MAGALU_STATE_COOKIE, authorization.stateCookieValue, {
                ...this.cookieOptions(), maxAge: MagaluOAuthService_1.MAGALU_STATE_MAX_AGE,
            });
            return res.redirect(authorization.authorizationUrl);
        }
        catch (error) {
            return this.failure(res, error);
        }
    }
    async handle(req, res) {
        const cookieValue = this.readStateCookie(req);
        res.clearCookie(MagaluOAuthService_1.MAGALU_STATE_COOKIE, this.cookieOptions());
        if (req.originalUrl.length > 8192) {
            return sendMagaluCallbackResponse(res, 414, "A URL recebida excede o tamanho permitido.");
        }
        const parsed = magaluCallbackSchemas_1.magaluCallbackQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return sendMagaluCallbackResponse(res, 400, "Os parâmetros de retorno são inválidos ou incompletos.");
        }
        try {
            const query = parsed.data;
            await this.service.completeAuthorization("code" in query ? { code: query.code, state: query.state } : { error: query.error, state: query.state }, cookieValue);
            return sendMagaluCallbackResponse(res, 200, "Conta Magalu conectada com sucesso.", true);
        }
        catch (error) {
            return this.failure(res, error);
        }
    }
    cookieOptions() {
        return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: MagaluOAuthService_1.MAGALU_STATE_COOKIE_PATH };
    }
    readStateCookie(req) {
        const cookies = (req.headers.cookie ?? "").split(";")
            .map((value) => value.trim().split("="))
            .filter(([name]) => name === MagaluOAuthService_1.MAGALU_STATE_COOKIE);
        if (cookies.length !== 1 || cookies[0]?.length !== 2)
            return undefined;
        try {
            return decodeURIComponent(cookies[0]?.[1] ?? "");
        }
        catch {
            return undefined;
        }
    }
    failure(res, error) {
        const known = error instanceof AppError_1.AppError;
        return sendMagaluCallbackResponse(res, known ? error.statusCode : 500, known ? error.message : "Não foi possível concluir a conexão Magalu. Inicie uma nova conexão.");
    }
}
exports.MagaluCallbackController = MagaluCallbackController;
//# sourceMappingURL=magaluCallbackController.js.map