import type { Express } from "express";

export function configureProxy(app: Express, environment: NodeJS.ProcessEnv = process.env) {
  // No Render, confiar apenas no proxy mais próximo; não aceitar toda a cadeia.
  app.set("trust proxy", environment.RENDER === "true" ? 1 : false);
}
