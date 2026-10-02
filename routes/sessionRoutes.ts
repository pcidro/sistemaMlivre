import { Router } from "express";
import { SessionController } from "../controllers/auth/sessionController";
import { isAuthenticated } from "../middlewares/isAuthenticated";

export function createSessionRoutes(controller = new SessionController()) {
  const routes = Router();
  routes.get("/me", isAuthenticated, (req, res) => controller.me(req, res));
  // Também permite limpar um cookie expirado, sem depender da validade do JWT.
  routes.post("/logout", (req, res) => controller.logout(req, res));
  return routes;
}

export default createSessionRoutes();
