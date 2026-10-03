import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../errors/AppError";
import { getMagaluConfig } from "./magaluConfig";

export const MAGALU_OAUTH_SCOPES = [
  "open:order-order-seller:read",
  "open:order-delivery-seller:read",
  "open:order-invoice-seller:read",
] as const;

const configSchema = z.object({
  MAGALU_CLIENT_ID: z.string().trim().min(1),
  MAGALU_CLIENT_SECRET: z.string().min(1),
  MAGALU_REDIRECT_URI: z.string().url(),
  MAGALU_AUTH_URL: z.string().trim().url().default("https://id.magalu.com"),
});

export function getMagaluOAuthConfig(env: Readonly<Record<string, string | undefined>> = process.env) {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) throw new AppError("Configuração OAuth da Magalu ausente ou inválida", 500);
  const values = parsed.data;
  const auth = new URL(values.MAGALU_AUTH_URL);
  const redirect = new URL(values.MAGALU_REDIRECT_URI);
  const localHttp = env.NODE_ENV !== "production" && redirect.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(redirect.hostname);
  if (auth.origin !== "https://id.magalu.com" || auth.pathname !== "/" ||
      auth.search || auth.hash || auth.username || auth.password ||
      (redirect.protocol !== "https:" && !localHttp) || redirect.username ||
      redirect.password || redirect.search || redirect.hash ||
      redirect.pathname !== "/api/marketplace-accounts/magalu/callback") {
    throw new AppError("URLs de autenticação ou callback da Magalu inválidas", 500);
  }
  const { environment, apiBaseUrl } = getMagaluConfig(env);
  return {
    clientId: values.MAGALU_CLIENT_ID,
    clientSecret: values.MAGALU_CLIENT_SECRET,
    redirectUri: values.MAGALU_REDIRECT_URI,
    authorizationUrl: new URL("/login", auth).toString(),
    tokenUrl: new URL("/oauth/token", auth).toString(),
    environment,
    audience: apiBaseUrl,
  };
}

export type MagaluOAuthConfig = ReturnType<typeof getMagaluOAuthConfig>;

export function magaluOAuthConfigFingerprint(config: MagaluOAuthConfig): string {
  return createHash("sha256").update(JSON.stringify([
    config.clientId, config.redirectUri, config.environment, config.tokenUrl,
  ])).digest("hex");
}
