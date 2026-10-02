import { Router } from "express";

import { CustomerController } from "../controllers/customers/customerController";
import { isAuthenticated } from "../middlewares/isAuthenticated";

export function createCustomerRoutes(controller = new CustomerController()) {
  const routes = Router();
  routes.use(isAuthenticated);
  routes.get("/", (req, res) => controller.list(req, res));
  routes.get("/:id", (req, res) => controller.get(req, res));
  return routes;
}

export default createCustomerRoutes();
