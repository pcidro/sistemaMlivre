import "dotenv/config";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import { decryptToken } from "../utils/tokenEncryption";
import { getMagaluConfig } from "../integrations/magalu/magaluConfig";
import { getMagaluOAuthConfig } from "../integrations/magalu/magaluOAuthConfig";
import { readMagaluTokenClaims } from "../integrations/magalu/magaluTokenResponse";

// Diagnóstico de revisão: somente leitura, sem imprimir credenciais, tenants ou dados pessoais.
async function main() {
  const result: Record<string, unknown> = {};
  try {
    const config = getMagaluConfig();
    getMagaluOAuthConfig();
    result.configuration = { valid: true, environment: config.environment, apiBaseUrl: config.apiBaseUrl };
  } catch { result.configuration = { valid: false }; }
  try {
    const accounts = await prisma.marketplaceAccount.findMany({
      where: { platform: "MAGALU", isActive: true, userId: { not: null } },
      select: { accessTokenEncrypted: true, refreshTokenEncrypted: true }, take: 10,
    });
    let sandboxAccounts = 0;
    let validSandboxAccessTokens = 0;
    for (const account of accounts) {
      try {
        const claims = readMagaluTokenClaims(decryptToken(account.accessTokenEncrypted), "https://api-sandbox.magalu.com");
        sandboxAccounts++;
        if (claims.exp * 1000 > Date.now() + 60_000) validSandboxAccessTokens++;
      } catch { /* Contar somente credenciais protegidas e compatíveis; nunca imprimir erros brutos. */ }
    }
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
      AND table_name IN ('marketplace_accounts', 'marketplace_oauth_states', 'customers', 'orders', 'order_items', 'invoices', 'imports')
    `;
    const required = ["marketplace_accounts", "marketplace_oauth_states", "customers", "orders", "order_items", "invoices", "imports"];
    const documentColumns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'customers' AND column_name IN ('document', 'document_type')
    `;
    const statuses = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'ImportStatus' AND enumlabel = 'PARTIAL_SUCCESS'
    `;
    let pendingMigrations: string[] | null = null;
    try {
      const applied = await prisma.$queryRaw<{ migration_name: string }[]>`
        SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      `;
      pendingMigrations = readdirSync(join(__dirname, "../prisma/migrations"), { withFileTypes: true })
        .filter(entry => entry.isDirectory() && !applied.some(migration => migration.migration_name === entry.name))
        .map(entry => entry.name).sort();
    } catch { /* Somente metadados; não inferir migrations aplicadas quando a consulta falhar. */ }
    result.database = { reachable: true, inspectedActiveMagaluAccounts: accounts.length, sandboxAccounts,
      validSandboxAccessTokens, missingRequiredTables: required.filter(name => !tables.some(table => table.table_name === name)),
      missingCustomerDocumentColumns: ["document", "document_type"].filter(name => !documentColumns.some(column => column.column_name === name)),
      supportsPartialSuccess: statuses.length === 1, pendingMigrations };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error &&
      typeof error.code === "string" && /^P\d{4}$/.test(error.code) ? error.code : null;
    result.database = { reachable: false, code };
  }
  finally { await prisma.$disconnect().catch(() => {}); }
  console.log(JSON.stringify(result, null, 2));
}
void main().catch(() => { console.log('{"review":"prerequisites_unavailable"}'); process.exitCode = 1; });
