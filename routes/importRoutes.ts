import { Router } from "express";

import { MercadoLivreImportController } from "../controllers/imports/mercadoLivreImportController";
import { MagaluImportController } from "../controllers/imports/magaluImportController";
import { isAuthenticated } from "../middlewares/isAuthenticated";
import { MercadoLivreSyncController } from "../controllers/imports/mercadoLivreSyncController";

export function createImportRoutes(controller = new MercadoLivreImportController(), magaluController = new MagaluImportController(), syncController = new MercadoLivreSyncController()) {
  const routes = Router();
  routes.post("/mercadolivre", isAuthenticated, (req, res) => controller.handle(req, res));
  routes.post("/magalu", isAuthenticated, (req, res) => magaluController.handle(req, res));
  routes.post("/mercadolivre/sync", isAuthenticated, (req, res) => syncController.start(req, res));
  routes.get("/", isAuthenticated, (req, res) => syncController.list(req, res));
  routes.get("/:id", isAuthenticated, (req, res) => syncController.get(req, res));
  return routes;
}

export default createImportRoutes();
