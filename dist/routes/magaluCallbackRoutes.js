"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMagaluCallbackRoutes = createMagaluCallbackRoutes;
const express_1 = require("express");
const express_rate_limit_1 = require("express-rate-limit");
const magaluCallbackController_1 = require("../controllers/marketplaceAccounts/magaluCallbackController");
const isAuthenticated_1 = require("../middlewares/isAuthenticated");
function createMagaluCallbackRoutes(controller = new magaluCallbackController_1.MagaluCallbackController()) {
    const routes = (0, express_1.Router)();
    const limiter = (0, express_rate_limit_1.rateLimit)({
        windowMs: 60_000,
        limit: 30,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        handler: (_req, res) => (0, magaluCallbackController_1.sendMagaluCallbackResponse)(res, 429, "Muitas tentativas de acesso. Aguarde um minuto e tente novamente."),
    });
    routes.use((_req, res, next) => {
        res.set({
            "Cache-Control": "private, no-store",
            "Pragma": "no-cache",
            "Referrer-Policy": "no-referrer",
            "Content-Security-Policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-Robots-Tag": "noindex, nofollow, noarchive",
        });
        next();
    }, limiter);
    // HEAD não deve iniciar uma conexão nem consumir state/code.
    routes.head(["/connect", "/callback"], (_req, res) => res.set("Allow", "GET").sendStatus(405));
    routes.get("/connect", isAuthenticated_1.isAuthenticated, (req, res) => controller.connect(req, res));
    routes.get("/callback", (req, res) => controller.handle(req, res));
    routes.all(["/connect", "/callback"], (_req, res) => {
        res.set("Allow", "GET");
        return (0, magaluCallbackController_1.sendMagaluCallbackResponse)(res, 405, "Método não permitido para este endereço.");
    });
    return routes;
}
//# sourceMappingURL=magaluCallbackRoutes.js.map