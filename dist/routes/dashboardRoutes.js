"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDashboardRoutes = createDashboardRoutes;
const express_1 = require("express");
const dashboardController_1 = require("../controllers/dashboard/dashboardController");
const isAuthenticated_1 = require("../middlewares/isAuthenticated");
function createDashboardRoutes(controller = new dashboardController_1.DashboardController()) {
    const routes = (0, express_1.Router)();
    routes.get("/", isAuthenticated_1.isAuthenticated, (req, res) => controller.handle(req, res));
    return routes;
}
exports.default = createDashboardRoutes();
//# sourceMappingURL=dashboardRoutes.js.map