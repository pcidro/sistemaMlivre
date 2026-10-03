import { Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../../errors/AppError";
import { MercadoLivreOAuthService } from "../../integrations/mercadolivre/mercadoLivreOAuthService";
import { getMercadoLivreCredentialDiagnostics } from "../../integrations/mercadolivre/mercadoLivreConfig";
import { MercadoLivreOAuthError, type MercadoLivreOAuthFailureCode } from "../../integrations/mercadolivre/mercadoLivreOAuthError";
import {
  MERCADO_LIVRE_OAUTH_STATE_COOKIE,
  MERCADO_LIVRE_OAUTH_STATE_COOKIE_PATH,
  MERCADO_LIVRE_OAUTH_STATE_MAX_AGE,
  validateMercadoLivreOAuthState,
} from "../../integrations/mercadolivre/mercadoLivreOAuthState";

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

function readCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = cookie.trim().split("=");

    if (cookieName === name) {
      try {
        return decodeURIComponent(valueParts.join("="));
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

function stateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: MERCADO_LIVRE_OAUTH_STATE_COOKIE_PATH,
  };
}

function frontendRedirectUrl(status: "success" | "error", reason?: MercadoLivreOAuthFailureCode): string {
  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    throw new AppError("FRONTEND_URL não configurada", 500);
  }

  const redirectUrl = new URL(frontendUrl);
  redirectUrl.searchParams.set("mercadolivre", status);
  redirectUrl.searchParams.delete("mercadolivre_error");
  if (reason) redirectUrl.searchParams.set("mercadolivre_error", reason);

  return redirectUrl.toString();
}

export class MercadoLivreOAuthController {
  constructor(
    private readonly oauthService: Pick<MercadoLivreOAuthService, "createAuthorization" | "completeAuthorization"> = new MercadoLivreOAuthService(),
  ) {}

  async connect(req: Request, res: Response) {
    const authorization = this.oauthService.createAuthorization(req.user_id);

    res.cookie(
      MERCADO_LIVRE_OAUTH_STATE_COOKIE,
      authorization.stateCookieValue,
      {
        ...stateCookieOptions(),
        maxAge: MERCADO_LIVRE_OAUTH_STATE_MAX_AGE,
      },
    );

    return res.redirect(authorization.authorizationUrl);
  }

  async callback(req: Request, res: Response) {
    try {
      const receivedState =
        typeof req.query.state === "string" ? req.query.state : "";
      const stateCookie = readCookie(req, MERCADO_LIVRE_OAUTH_STATE_COOKIE);

      res.clearCookie(
        MERCADO_LIVRE_OAUTH_STATE_COOKIE,
        stateCookieOptions(),
      );

      const { userId } = validateMercadoLivreOAuthState(
        receivedState,
        stateCookie,
      );

      if (typeof req.query.error === "string") {
        throw new MercadoLivreOAuthError("Autorização do Mercado Livre não concluída", 400, "authorization_denied");
      }

      const query = callbackQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new MercadoLivreOAuthError("Retorno de autorização inválido", 400, "callback_invalid");
      }
      await this.oauthService.completeAuthorization(query.data.code, userId);

      return res.redirect(frontendRedirectUrl("success"));
    } catch (error) {
      const reason = error instanceof MercadoLivreOAuthError ? error.code : "unexpected";
      // Não registrar o erro bruto: query, mensagens e stack podem conter tokens.
      console.error("mercadolivre_oauth_callback_failed", {
        reason,
        upstreamStatus: error instanceof MercadoLivreOAuthError ? error.upstreamStatus : null,
        upstreamError: error instanceof MercadoLivreOAuthError ? error.upstreamError : null,
        ...(error instanceof MercadoLivreOAuthError && error.upstreamError === "invalid_client"
          ? { credentialCheck: getMercadoLivreCredentialDiagnostics() }
          : {}),
      });
      return res.redirect(frontendRedirectUrl("error", reason));
    }
  }
}
