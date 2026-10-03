import { z } from "zod";

import { MercadoLivreOAuthError } from "./mercadoLivreOAuthError";
import { MERCADO_LIVRE_OAUTH_STATE_COOKIE_PATH } from "./mercadoLivreOAuthState";

const mercadoLivreConfigSchema = z.object({
  MERCADO_LIVRE_CLIENT_ID: z.string().trim().min(1),
  MERCADO_LIVRE_CLIENT_SECRET: z.string().trim().min(1),
  MERCADO_LIVRE_REDIRECT_URI: z.url(),
});

export interface MercadoLivreConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getMercadoLivreCredentialDiagnostics() {
  const clientId = process.env.MERCADO_LIVRE_CLIENT_ID?.trim() ?? "";
  const secret = process.env.MERCADO_LIVRE_CLIENT_SECRET?.trim() ?? "";

  return {
    // O ID do aplicativo é público. Nunca refletir um valor arbitrário da variável.
    clientId: /^\d{1,20}$/.test(clientId) ? clientId : null,
    clientIdLooksValid: /^\d{1,20}$/.test(clientId),
    secretLength: secret.length,
    secretHasWhitespace: /\s/.test(secret),
    secretHasNonAscii: /[^\x21-\x7e]/.test(secret),
    secretHasQuotes: /["'“”‘’]/.test(secret),
    secretLooksMasked: /^[*•●]+$/.test(secret),
  };
}

export function getMercadoLivreOAuthDiagnostics() {
  function readHttpUrl(value: string | undefined): URL | null {
    if (!value) return null;
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url : null;
    } catch {
      return null;
    }
  }

  const frontend = readHttpUrl(process.env.FRONTEND_URL);
  const callback = readHttpUrl(process.env.MERCADO_LIVRE_REDIRECT_URI);

  // Somente indicadores: nem URLs arbitrárias, segredos ou fingerprints.
  return {
    credentialCheck: getMercadoLivreCredentialDiagnostics(),
    oauthVariablesValid: mercadoLivreConfigSchema.safeParse(process.env).success,
    jwtSecretConfigured: Boolean(process.env.JWT_SECRET?.trim()),
    frontendUrlValid: Boolean(frontend && !frontend.username && !frontend.password),
    callbackUrlValid: Boolean(callback),
    callbackUsesFrontendOrigin: callback && frontend ? callback.origin === frontend.origin : null,
    callbackUsesExpectedPath: callback ? callback.pathname === MERCADO_LIVRE_OAUTH_STATE_COOKIE_PATH : null,
    callbackUsesHttps: callback ? callback.protocol === "https:" : null,
    callbackHasQueryOrFragment: callback ? Boolean(callback.search || callback.hash) : null,
    callbackHasUrlCredentials: callback ? Boolean(callback.username || callback.password) : null,
    pkceImplemented: false,
  };
}

export function getMercadoLivreConfig(): MercadoLivreConfig {
  const result = mercadoLivreConfigSchema.safeParse(process.env);

  if (!result.success) {
    throw new MercadoLivreOAuthError(
      "Configuração OAuth do Mercado Livre ausente ou inválida",
      500,
      "oauth_configuration",
    );
  }

  return {
    clientId: result.data.MERCADO_LIVRE_CLIENT_ID,
    clientSecret: result.data.MERCADO_LIVRE_CLIENT_SECRET,
    redirectUri: result.data.MERCADO_LIVRE_REDIRECT_URI,
  };
}
