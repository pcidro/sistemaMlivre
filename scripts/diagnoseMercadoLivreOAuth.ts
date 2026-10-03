import "dotenv/config";
import { randomUUID } from "node:crypto";
import { getMercadoLivreOAuthDiagnostics } from "../integrations/mercadolivre/mercadoLivreConfig";
import { MercadoLivreOAuthClient } from "../integrations/mercadolivre/mercadoLivreOAuthClient";
import { MercadoLivreOAuthError } from "../integrations/mercadolivre/mercadoLivreOAuthError";

async function main() {
  const configuration = getMercadoLivreOAuthDiagnostics();
  if (!process.argv.includes("--probe")) {
    console.log(JSON.stringify(configuration, null, 2));
    return;
  }

  // Uma chamada com código fictício: não usa autorização real nem persiste tokens.
  const client = new MercadoLivreOAuthClient((input, init) => fetch(input, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  }));

  try {
    await client.exchangeAuthorizationCode(`invalid-ml-diagnostic-${randomUUID()}`);
    console.log(JSON.stringify({ configuration, tokenProbe: { unexpectedAcceptance: true } }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ configuration, tokenProbe: {
      reason: error instanceof MercadoLivreOAuthError ? error.code : "unexpected",
      upstreamStatus: error instanceof MercadoLivreOAuthError ? error.upstreamStatus : null,
      upstreamError: error instanceof MercadoLivreOAuthError ? error.upstreamError : null,
    } }, null, 2));
  }
}

void main();
