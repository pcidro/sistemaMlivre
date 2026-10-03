import type { Request, Response } from "express";

import { magaluCallbackQuerySchema } from "../../schemas/magaluCallbackSchemas";
import { AppError } from "../../errors/AppError";
import { MagaluOAuthService, MAGALU_STATE_COOKIE, MAGALU_STATE_COOKIE_PATH, MAGALU_STATE_MAX_AGE } from "../../integrations/magalu/MagaluOAuthService";

export function sendMagaluCallbackResponse(res: Response, status: number, message: string, connected = false) {
  if (res.req.accepts(["html", "json"]) === "json") {
    return res.status(status).json({ status: connected ? "connected" : "not_connected", message });
  }
  // Navegação retorna à UI com um resultado fixo, nunca parâmetros do provedor.
  try {
    const frontend = new URL(process.env.FRONTEND_URL ?? "");
    if (["http:", "https:"].includes(frontend.protocol) && !frontend.username && !frontend.password &&
      (process.env.NODE_ENV !== "production" || frontend.protocol === "https:")) {
      const redirect = new URL("/marketplace-accounts", frontend.origin);
      redirect.searchParams.set("magalu", connected ? "success" : "error");
      return res.redirect(303, redirect.toString());
    }
  } catch { /* Sem URL válida do frontend, mantém a confirmação segura abaixo. */ }
  const escapedMessage = message.replace(/[&<>"']/g, (value) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[value]!);
  return res.status(status).type("html").send(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Conexão Magalu | LJ Fontes</title></head><body><main><h1>Conexão Magalu</h1><p>${escapedMessage}</p><p>Você pode fechar esta página.</p></main></body></html>`,
  );
}

export class MagaluCallbackController {
  constructor(private readonly service: Pick<MagaluOAuthService, "createAuthorization" | "completeAuthorization"> = new MagaluOAuthService()) {}

  async connect(req: Request, res: Response) {
    try {
      const authorization = await this.service.createAuthorization(req.user_id);
      res.cookie(MAGALU_STATE_COOKIE, authorization.stateCookieValue, {
        ...this.cookieOptions(), maxAge: MAGALU_STATE_MAX_AGE,
      });
      return res.redirect(authorization.authorizationUrl);
    } catch (error) {
      return this.failure(res, error);
    }
  }

  async handle(req: Request, res: Response) {
    const cookieValue = this.readStateCookie(req);
    res.clearCookie(MAGALU_STATE_COOKIE, this.cookieOptions());
    if (req.originalUrl.length > 8192) {
      return sendMagaluCallbackResponse(res, 414, "A URL recebida excede o tamanho permitido.");
    }
    const parsed = magaluCallbackQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendMagaluCallbackResponse(res, 400, "Os parâmetros de retorno são inválidos ou incompletos.");
    }
    try {
      const query = parsed.data;
      await this.service.completeAuthorization(
        "code" in query ? { code: query.code, state: query.state } : { error: query.error, state: query.state },
        cookieValue,
      );
      return sendMagaluCallbackResponse(res, 200, "Conta Magalu conectada com sucesso.", true);
    } catch (error) {
      return this.failure(res, error);
    }
  }

  private cookieOptions() {
    return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: MAGALU_STATE_COOKIE_PATH };
  }

  private readStateCookie(req: Request): string | undefined {
    const cookies = (req.headers.cookie ?? "").split(";")
      .map((value) => value.trim().split("="))
      .filter(([name]) => name === MAGALU_STATE_COOKIE);
    if (cookies.length !== 1 || cookies[0]?.length !== 2) return undefined;
    try { return decodeURIComponent(cookies[0]?.[1] ?? ""); } catch { return undefined; }
  }

  private failure(res: Response, error: unknown) {
    const known = error instanceof AppError;
    return sendMagaluCallbackResponse(res, known ? error.statusCode : 500,
      known ? error.message : "Não foi possível concluir a conexão Magalu. Inicie uma nova conexão.");
  }
}
