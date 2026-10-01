"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mercadoLivreOAuthController_1 = require("../controllers/marketplaceAccounts/mercadoLivreOAuthController");
const isAuthenticated_1 = require("../middlewares/isAuthenticated");
const marketplaceAccountRoutes = (0, express_1.Router)();
const mercadoLivreOAuthController = new mercadoLivreOAuthController_1.MercadoLivreOAuthController();
marketplaceAccountRoutes.get("/mercadolivre/connect", isAuthenticated_1.isAuthenticated, (req, res) => mercadoLivreOAuthController.connect(req, res));
marketplaceAccountRoutes.get("/mercadolivre/callback", (req, res) => mercadoLivreOAuthController.callback(req, res));
exports.default = marketplaceAccountRoutes;
//# sourceMappingURL=marketplaceAccountRoutes.js.map