import { z } from "zod";

import { AppError } from "../../errors/AppError";

export type MagaluEnvironment = "sandbox" | "production";

export interface MagaluConfig {
  environment: MagaluEnvironment;
  apiBaseUrl: string;
  channelId: string;
}

// IDs oficiais: Sandbox/overview e Guia de Desenvolvimento/sales-channel-id.
const environments: Record<MagaluEnvironment, Omit<MagaluConfig, "environment">> = {
  sandbox: {
    apiBaseUrl: "https://api-sandbox.magalu.com",
    channelId: "5f62650a-0039-4d65-9b96-266d498c03bd",
  },
  production: {
    apiBaseUrl: "https://api.magalu.com",
    channelId: "9fe0d853-732b-4e4a-a0b0-cff988ed043d",
  },
};

const environmentSchema = z.object({
  MAGALU_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  MAGALU_API_URL: z.string().trim().optional(),
});

/** Apenas configuração de ambiente; não exige credenciais nem consulta APIs. */
export function getMagaluConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): MagaluConfig {
  const result = environmentSchema.safeParse(env);
  if (!result.success) {
    throw new AppError("Configuração Magalu inválida: MAGALU_ENV deve ser sandbox ou production", 500);
  }

  const environment = result.data.MAGALU_ENV;
  const settings = environments[environment];
  const configuredUrl = result.data.MAGALU_API_URL;

  // Compatibilidade com a variável já cadastrada no Render. Ela não pode
  // apontar para outro ambiente ou destino; MAGALU_ENV é a fonte de verdade.
  if (configuredUrl) {
    let matchesEnvironment = false;
    try {
      const url = new URL(configuredUrl);
      matchesEnvironment = url.origin === settings.apiBaseUrl &&
        url.pathname === "/" && !url.search && !url.hash &&
        !url.username && !url.password;
    } catch {
      // Não incluir o valor recebido na mensagem de erro.
    }
    if (!matchesEnvironment) {
      throw new AppError(
        "MAGALU_API_URL deve corresponder ao host oficial de MAGALU_ENV; ajuste ou remova MAGALU_API_URL",
        500,
      );
    }
  }

  return { environment, ...settings };
}
