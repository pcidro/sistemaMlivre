import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { MagaluCallbackController, sendMagaluCallbackResponse } from "../controllers/marketplaceAccounts/magaluCallbackController";

export function createMagaluCallbackRoutes() {
  const routes = Router();
  const controller = new MagaluCallbackController();
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => sendMagaluCallbackResponse(res, 429,
      "Muitas tentativas de acesso. Aguarde um minuto e tente novamente."),
  });

  routes.all("/callback", (_req, res, next) => {
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
  routes.get("/callback", (req, res) => controller.handle(req, res));
  routes.all("/callback", (_req, res) => {
    res.set("Allow", "GET, HEAD");
    return sendMagaluCallbackResponse(res, 405, "Método não permitido para este endereço.");
  });
  return routes;
}
