import { Router } from "express";

import { MercadoLivreImportController } from "../controllers/imports/mercadoLivreImportController";
import { isAuthenticated } from "../middlewares/isAuthenticated";

export function createImportRoutes(controller = new MercadoLivreImportController()) {
  const routes = Router();
  routes.post("/mercadolivre", isAuthenticated, (req, res) => controller.handle(req, res));
  return routes;
}

export default createImportRoutes();
