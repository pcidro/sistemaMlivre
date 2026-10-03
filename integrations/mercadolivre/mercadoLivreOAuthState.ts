import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../errors/AppError";
import { MercadoLivreOAuthError, type MercadoLivreOAuthFailureCode } from "./mercadoLivreOAuthError";

const STATE_DURATION_MILLISECONDS = 10 * 60 * 1000;
const STATE_SIGNATURE_CONTEXT = "mercado-livre-oauth-state";

export const MERCADO_LIVRE_OAUTH_STATE_COOKIE = "ml_oauth_state";
export const MERCADO_LIVRE_OAUTH_STATE_COOKIE_PATH =
  "/api/marketplace-accounts/mercadolivre/callback";
export const MERCADO_LIVRE_OAUTH_STATE_MAX_AGE = STATE_DURATION_MILLISECONDS;

const statePayloadSchema = z.object({
  state: z.string().min(1),
  userId: z.string().uuid(),
  expiresAt: z.number().int().positive(),
});

interface OAuthStateSession {
  state: string;
  cookieValue: string;
}

function getStateSigningSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new MercadoLivreOAuthError("Configuração de segurança OAuth ausente", 500, "oauth_configuration");
  }

  return jwtSecret;
}

function createSignature(encodedPayload: string): Buffer {
  return createHmac("sha256", getStateSigningSecret())
    .update(`${STATE_SIGNATURE_CONTEXT}.${encodedPayload}`)
    .digest();
}

function safelyEquals(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first, "utf8");
  const secondBuffer = Buffer.from(second, "utf8");

  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  );
}

function invalidState(code: MercadoLivreOAuthFailureCode = "state_invalid"): never {
  throw new MercadoLivreOAuthError("State OAuth inválido ou expirado", 400, code);
}

export function createMercadoLivreOAuthState(
  userId: string,
): OAuthStateSession {
  const state = randomBytes(32).toString("base64url");
  const encodedPayload = Buffer.from(
    JSON.stringify({
      state,
      userId,
      expiresAt: Date.now() + STATE_DURATION_MILLISECONDS,
    }),
    "utf8",
  ).toString("base64url");
  const signature = createSignature(encodedPayload).toString("base64url");

  return {
    state,
    cookieValue: `${encodedPayload}.${signature}`,
  };
}

export function validateMercadoLivreOAuthState(
  receivedState: string,
  cookieValue: string | undefined,
): { userId: string } {
  if (!cookieValue) {
    return invalidState("state_missing");
  }

  const [encodedPayload, encodedSignature, ...extraParts] =
    cookieValue.split(".");

  if (!encodedPayload || !encodedSignature || extraParts.length > 0) {
    return invalidState();
  }

  const providedSignature = Buffer.from(encodedSignature, "base64url");
  const expectedSignature = createSignature(encodedPayload);

  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return invalidState();
  }

  try {
    const payload = statePayloadSchema.parse(
      JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")),
    );

    if (
      payload.expiresAt <= Date.now() ||
      !safelyEquals(payload.state, receivedState)
    ) {
      return invalidState();
    }

    return { userId: payload.userId };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    return invalidState();
  }
}
