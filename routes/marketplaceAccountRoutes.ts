import { Router } from "express";

import { MercadoLivreOAuthController } from "../controllers/marketplaceAccounts/mercadoLivreOAuthController";
import { isAuthenticated } from "../middlewares/isAuthenticated";

const marketplaceAccountRoutes = Router();
const mercadoLivreOAuthController = new MercadoLivreOAuthController();

marketplaceAccountRoutes.get(
  "/mercadolivre/connect",
  isAuthenticated,
  (req, res) => mercadoLivreOAuthController.connect(req, res),
);

marketplaceAccountRoutes.get("/mercadolivre/callback", (req, res) =>
  mercadoLivreOAuthController.callback(req, res),
);

export default marketplaceAccountRoutes;
