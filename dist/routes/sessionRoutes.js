"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSessionRoutes = createSessionRoutes;
const express_1 = require("express");
const sessionController_1 = require("../controllers/auth/sessionController");
const isAuthenticated_1 = require("../middlewares/isAuthenticated");
function createSessionRoutes(controller = new sessionController_1.SessionController()) {
    const routes = (0, express_1.Router)();
    routes.get("/me", isAuthenticated_1.isAuthenticated, (req, res) => controller.me(req, res));
    // Também permite limpar um cookie expirado, sem depender da validade do JWT.
    routes.post("/logout", (req, res) => controller.logout(req, res));
    return routes;
}
exports.default = createSessionRoutes();
//# sourceMappingURL=sessionRoutes.js.map