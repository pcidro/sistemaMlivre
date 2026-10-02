import { Router } from "express";

import { MercadoLivreOAuthController } from "../controllers/marketplaceAccounts/mercadoLivreOAuthController";
import { MarketplaceAccountController } from "../controllers/marketplaceAccounts/marketplaceAccountController";
import { isAuthenticated } from "../middlewares/isAuthenticated";
import { createMagaluCallbackRoutes } from "./magaluCallbackRoutes";

const marketplaceAccountRoutes = Router();
const mercadoLivreOAuthController = new MercadoLivreOAuthController();
const marketplaceAccountController = new MarketplaceAccountController();

marketplaceAccountRoutes.use("/magalu", createMagaluCallbackRoutes());

marketplaceAccountRoutes.get("/", isAuthenticated, (req, res) =>
  marketplaceAccountController.list(req, res),
);

marketplaceAccountRoutes.get(
  "/mercadolivre/connect",
  isAuthenticated,
  (req, res) => mercadoLivreOAuthController.connect(req, res),
);

marketplaceAccountRoutes.get("/mercadolivre/callback", (req, res) =>
  mercadoLivreOAuthController.callback(req, res),
);

marketplaceAccountRoutes.delete(
  "/mercadolivre/:marketplaceAccountId",
  isAuthenticated,
  (req, res) => marketplaceAccountController.disconnectMercadoLivre(req, res),
);

export default marketplaceAccountRoutes;
