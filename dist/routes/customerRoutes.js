"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCustomerRoutes = createCustomerRoutes;
const express_1 = require("express");
const customerController_1 = require("../controllers/customers/customerController");
const isAuthenticated_1 = require("../middlewares/isAuthenticated");
function createCustomerRoutes(controller = new customerController_1.CustomerController()) {
    const routes = (0, express_1.Router)();
    routes.use(isAuthenticated_1.isAuthenticated);
    routes.get("/", (req, res) => controller.list(req, res));
    routes.get("/:id", (req, res) => controller.get(req, res));
    return routes;
}
exports.default = createCustomerRoutes();
//# sourceMappingURL=customerRoutes.js.map