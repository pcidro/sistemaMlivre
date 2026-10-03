import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { MagaluCallbackController, sendMagaluCallbackResponse } from "../controllers/marketplaceAccounts/magaluCallbackController";
import { isAuthenticated } from "../middlewares/isAuthenticated";

export function createMagaluCallbackRoutes(controller = new MagaluCallbackController()) {
  const routes = Router();
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => sendMagaluCallbackResponse(res, 429,
      "Muitas tentativas de acesso. Aguarde um minuto e tente novamente."),
  });

  routes.use((_req, res, next) => {
    res.set({
      "Cache-Control": "private, no-store",
      "Pragma": "no-cache",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    });
    next();
  }, limiter);
  // HEAD não deve iniciar uma conexão nem consumir state/code.
  routes.head(["/connect", "/callback"], (_req, res) => res.set("Allow", "GET").sendStatus(405));
  routes.get("/connect", isAuthenticated, (req, res) => controller.connect(req, res));
  routes.get("/callback", (req, res) => controller.handle(req, res));
  routes.all(["/connect", "/callback"], (_req, res) => {
    res.set("Allow", "GET");
    return sendMagaluCallbackResponse(res, 405, "Método não permitido para este endereço.");
  });
  return routes;
}
