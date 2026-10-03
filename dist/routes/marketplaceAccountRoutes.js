"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mercadoLivreOAuthController_1 = require("../controllers/marketplaceAccounts/mercadoLivreOAuthController");
const marketplaceAccountController_1 = require("../controllers/marketplaceAccounts/marketplaceAccountController");
const isAuthenticated_1 = require("../middlewares/isAuthenticated");
const magaluCallbackRoutes_1 = require("./magaluCallbackRoutes");
const marketplaceAccountRoutes = (0, express_1.Router)();
const mercadoLivreOAuthController = new mercadoLivreOAuthController_1.MercadoLivreOAuthController();
const marketplaceAccountController = new marketplaceAccountController_1.MarketplaceAccountController();
marketplaceAccountRoutes.use("/magalu", (0, magaluCallbackRoutes_1.createMagaluCallbackRoutes)());
marketplaceAccountRoutes.get("/", isAuthenticated_1.isAuthenticated, (req, res) => marketplaceAccountController.list(req, res));
marketplaceAccountRoutes.get("/mercadolivre/connect", isAuthenticated_1.isAuthenticated, (req, res) => mercadoLivreOAuthController.connect(req, res));
marketplaceAccountRoutes.get("/mercadolivre/callback", (req, res) => mercadoLivreOAuthController.callback(req, res));
marketplaceAccountRoutes.delete("/mercadolivre/:marketplaceAccountId", isAuthenticated_1.isAuthenticated, (req, res) => marketplaceAccountController.disconnectMercadoLivre(req, res));
exports.default = marketplaceAccountRoutes;
//# sourceMappingURL=marketplaceAccountRoutes.js.map