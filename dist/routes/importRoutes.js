"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createImportRoutes = createImportRoutes;
const express_1 = require("express");
const mercadoLivreImportController_1 = require("../controllers/imports/mercadoLivreImportController");
const isAuthenticated_1 = require("../middlewares/isAuthenticated");
function createImportRoutes(controller = new mercadoLivreImportController_1.MercadoLivreImportController()) {
    const routes = (0, express_1.Router)();
    routes.post("/mercadolivre", isAuthenticated_1.isAuthenticated, (req, res) => controller.handle(req, res));
    return routes;
}
exports.default = createImportRoutes();
//# sourceMappingURL=importRoutes.js.map