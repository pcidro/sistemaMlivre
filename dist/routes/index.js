"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = require("express-rate-limit");
const authController_1 = require("../controllers/auth/authController");
const routes = (0, express_1.Router)();
const authUserController = new authController_1.AuthUserController();
const loginRateLimit = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Muitas tentativas de login. Tente novamente mais tarde." },
});
routes.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
routes.post("/auth/login", loginRateLimit, (req, res) => authUserController.handle(req, res));
exports.default = routes;
//# sourceMappingURL=index.js.map