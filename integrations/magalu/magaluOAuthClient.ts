import { randomUUID } from "node:crypto";
import { AppError } from "../../errors/AppError";
import { MAGALU_OAUTH_SCOPES, type MagaluOAuthConfig } from "./magaluOAuthConfig";
import { parseMagaluTokenResponse } from "./magaluTokenResponse";
import { MagaluHttpError, magaluHttpFailure, safeMagaluRequestId, discardMagaluResponse } from "./magaluHttpError";

export class MagaluOAuthClient {
  constructor(private readonly fetchFn: typeof globalThis.fetch = globalThis.fetch) {}

  getAuthorizationUrl(state: string, config: MagaluOAuthConfig): string {
    const url = new URL(config.authorizationUrl);
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: MAGALU_OAUTH_SCOPES.join(" "),
      response_type: "code",
      choose_tenants: "true",
      state,
    }).toString();
    return url.toString();
  }

  async exchangeAuthorizationCode(code: string, config: MagaluOAuthConfig) {
    try {
      const response = await this.fetchFn(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          code,
          grant_type: "authorization_code",
        }),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        await discardMagaluResponse(response);
        throw new Error("Token exchange refused");
      }
      const tokens = parseMagaluTokenResponse(await response.json(), config);
      if (!tokens.refreshToken) throw new Error("Missing refresh token");
      return { ...tokens, refreshToken: tokens.refreshToken };
    } catch {
      // Não propagar body, credenciais, erro de rede ou query string do provedor.
      throw new AppError("Não foi possível concluir a troca do código de autorização da Magalu. Inicie uma nova conexão.", 502);
    }
  }

  async refreshAccessToken(refreshToken: string, config: MagaluOAuthConfig) {
    const requestId = randomUUID();
    let response: Response;
    try {
      response = await this.fetchFn(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "X-Request-ID": requestId },
        body: new URLSearchParams({ grant_type: "refresh_token", client_id: config.clientId,
          client_secret: config.clientSecret, refresh_token: refreshToken }),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // Não repetir automaticamente: o servidor pode ter rotacionado o refresh.
      throw new MagaluHttpError("Não foi possível comunicar com o ID Magalu para renovar a autorização.", 503, "network", null, requestId);
    }
    if (!response.ok) {
      const error = magaluHttpFailure(response, Date.now(), requestId, true);
      await discardMagaluResponse(response);
      throw error;
    }
    try {
      return parseMagaluTokenResponse(await response.json(), config);
    } catch {
      throw new MagaluHttpError("O ID Magalu retornou credenciais de renovação inválidas.", 502,
        "invalid_response", response.status, safeMagaluRequestId(response.headers) ?? requestId);
    }
  }
}
