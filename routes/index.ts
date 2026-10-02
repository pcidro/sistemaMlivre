import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { AuthUserController } from "../controllers/auth/authController";
import sessionRoutes from "./sessionRoutes";

const routes = Router();
routes.use("/auth", sessionRoutes);

const authUserController = new AuthUserController();

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente mais tarde." },
});

routes.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

routes.post("/auth/login", loginRateLimit, (req, res) =>
  authUserController.handle(req, res),
);

export default routes;
