import { Router } from "express";

import { DashboardController } from "../controllers/dashboard/dashboardController";
import { isAuthenticated } from "../middlewares/isAuthenticated";

export function createDashboardRoutes(controller = new DashboardController()) {
  const routes = Router();
  routes.get("/", isAuthenticated, (req, res) => controller.handle(req, res));
  return routes;
}

export default createDashboardRoutes();
