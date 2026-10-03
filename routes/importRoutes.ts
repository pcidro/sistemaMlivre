import { Router } from "express";

import { MercadoLivreImportController } from "../controllers/imports/mercadoLivreImportController";
import { MagaluImportController } from "../controllers/imports/magaluImportController";
import { isAuthenticated } from "../middlewares/isAuthenticated";

export function createImportRoutes(controller = new MercadoLivreImportController(), magaluController = new MagaluImportController()) {
  const routes = Router();
  routes.post("/mercadolivre", isAuthenticated, (req, res) => controller.handle(req, res));
  routes.post("/magalu", isAuthenticated, (req, res) => magaluController.handle(req, res));
  return routes;
}

export default createImportRoutes();
