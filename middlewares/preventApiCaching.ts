import type { RequestHandler } from "express";

// Inclui erros e redirects OAuth para não armazenar sessões/dados no proxy do frontend.
export const preventApiCaching: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
};
