import { createHash } from "node:crypto";
import { Client } from "pg";

export const syncMigration = "20261006120000_add_mercadolivre_sync";
const requiredColumns = {
  imports: ["id", "platform", "status", "started_at", "finished_at", "date_from", "date_to", "automatic", "updated_at", "orders_found", "orders_processed", "customers_with_phone", "customers_without_phone", "errors_count", "marketplace_account_id"],
  marketplace_accounts: ["id", "platform", "name", "cnpj", "external_account_id", "access_token_encrypted", "refresh_token_encrypted", "token_expires_at", "last_sync_at", "is_active", "created_at", "updated_at", "user_id"],
} as const;

export interface SchemaDiagnosticClient {
  connect(): Promise<unknown>;
  query(sql: string, values?: string[]): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<unknown>;
}

export interface DatabaseSchemaDiagnostic {
  databaseTarget: string | null;
  migrationSchemaMatchesRuntime: boolean | null;
  status: "ready" | "schema_missing" | "check_failed";
  missingColumns?: string[];
  migrationApplied?: boolean;
}

/** Só consulta metadados; não lê clientes, contas ou tokens e não aplica migrations. */
export async function diagnoseDatabaseSchema(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
  createClient: (url: string) => SchemaDiagnosticClient = url => new Client({
    connectionString: url, connectionTimeoutMillis: 8_000, query_timeout: 8_000,
  }),
): Promise<DatabaseSchemaDiagnostic> {
  const result: DatabaseSchemaDiagnostic = {
    databaseTarget: null, migrationSchemaMatchesRuntime: null, status: "check_failed",
  };
  if (!databaseUrl) return result;
  let client: SchemaDiagnosticClient | undefined;
  try {
    const url = new URL(databaseUrl);
    // O adapter PrismaPg usado pela aplicação consulta public por padrão.
    result.migrationSchemaMatchesRuntime = (url.searchParams.get("schema") ?? "public") === "public";
    // Identifica o destino sem registrar usuário, senha, host ou DATABASE_URL.
    const target = [url.hostname.replace(/-pooler(?=\.)/, ""), url.port || "5432", url.pathname, "public"].join("|");
    result.databaseTarget = createHash("sha256").update(target).digest("hex").slice(0, 12);
    client = createClient(databaseUrl);
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const columns = await client.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('imports', 'marketplace_accounts')",
    );
    result.missingColumns = Object.entries(requiredColumns).flatMap(([table, names]) =>
      names.filter(name => !columns.rows.some(row => row.table_name === table && row.column_name === name))
        .map(name => `${table}.${name}`),
    );
    const history = await client.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations') AS present",
    );
    result.migrationApplied = false;
    if (history.rows[0]?.present === true) {
      const migration = await client.query(
        'SELECT finished_at IS NOT NULL AND rolled_back_at IS NULL AS applied FROM public."_prisma_migrations" WHERE migration_name = $1 ORDER BY started_at DESC LIMIT 1',
        [syncMigration],
      );
      result.migrationApplied = migration.rows[0]?.applied === true;
    }
    await client.query("ROLLBACK");
    result.status = result.missingColumns.length === 0 ? "ready" : "schema_missing";
  } catch {
    // Mensagens do driver podem conter a conexão; nunca copie o erro para o log.
    result.status = "check_failed";
  } finally {
    await client?.end().catch(() => {});
  }
  return result;
}

export async function logDatabaseSchemaDiagnostic() {
  console.log("database_schema_diagnostic", JSON.stringify(await diagnoseDatabaseSchema()));
}
