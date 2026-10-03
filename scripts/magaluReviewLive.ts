import "dotenv/config";
import { randomUUID } from "node:crypto";
import { getMagaluOAuthConfig } from "../integrations/magalu/magaluOAuthConfig";
import { MagaluOAuthClient } from "../integrations/magalu/magaluOAuthClient";
import { safeMagaluRequestId } from "../integrations/magalu/magaluHttpError";
import { getMagaluConfig } from "../integrations/magalu/magaluConfig";

// Testes negativos oficiais; não busca produção, não cria dados e não imprime bodies/tokens.
async function main() {
  const cases: unknown[] = [];
  const sandbox = getMagaluConfig({ MAGALU_ENV: "sandbox" });
  for (const path of ["/seller/v1/orders?_offset=0&_limit=1", "/seller/v1/deliveries?_offset=0&_limit=1"]) {
    try {
      const response = await fetch(new URL(path, sandbox.apiBaseUrl), {
        headers: { Accept: "application/json", "X-Request-ID": randomUUID(),
          "X-Channel-Id": sandbox.channelId },
        redirect: "error", signal: AbortSignal.timeout(15_000),
      });
      cases.push({ test: path.split("?")[0], authentication: "absent", status: response.status,
        requestId: safeMagaluRequestId(response.headers), expectedUnauthorized: response.status === 401 });
      await response.body?.cancel();
    } catch { cases.push({ test: path.split("?")[0], outcome: "network_unavailable" }); }
  }
  try {
    const config = getMagaluOAuthConfig();
    if (config.environment !== "sandbox") throw new Error("Sandbox required");
    let status: number | null = null;
    let requestId: string | null = null;
    const client = new MagaluOAuthClient(async (url, options) => {
      const response = await fetch(url, options);
      status = response.status; requestId = safeMagaluRequestId(response.headers);
      return response;
    });
    try {
      await client.exchangeAuthorizationCode(`invalid-magalu-review-${randomUUID()}`, config);
      cases.push({ test: "invalid_authorization_code", outcome: "unexpected_acceptance", status });
    } catch {
      cases.push({ test: "invalid_authorization_code", status, requestId,
        outcome: status === null ? "network_unavailable" : [400, 401].includes(status) ? "rejected" : "unexpected_status" });
    }
  } catch { cases.push({ test: "invalid_authorization_code", outcome: "configuration_unavailable" }); }
  console.log(JSON.stringify(cases, null, 2));
}
void main().catch(() => { console.log('{"review":"live_tests_unavailable"}'); process.exitCode = 1; });
