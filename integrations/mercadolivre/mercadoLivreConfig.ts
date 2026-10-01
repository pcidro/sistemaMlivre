import { z } from "zod";

import { AppError } from "../../errors/AppError";

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

export function getMercadoLivreConfig(): MercadoLivreConfig {
  const result = mercadoLivreConfigSchema.safeParse(process.env);

  if (!result.success) {
    throw new AppError(
      "Configuração OAuth do Mercado Livre ausente ou inválida",
      500,
    );
  }

  return {
    clientId: result.data.MERCADO_LIVRE_CLIENT_ID,
    clientSecret: result.data.MERCADO_LIVRE_CLIENT_SECRET,
    redirectUri: result.data.MERCADO_LIVRE_REDIRECT_URI,
  };
}
