import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

import { AppError } from "../../errors/AppError";
import type { Import, Prisma } from "../../generated/prisma/client";
import { DashboardService } from "./DashboardService";
import type { DashboardReadTransaction } from "./DashboardService";

let db: PGlite;

before(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TYPE platform AS ENUM ('MERCADO_LIVRE', 'MAGALU');
    CREATE TABLE marketplace_accounts (id text PRIMARY KEY, user_id text, is_active boolean);
    CREATE TABLE customers (id text PRIMARY KEY, normalized_phone text);
    CREATE TABLE orders (
      id text PRIMARY KEY, customer_id text REFERENCES customers,
      marketplace_account_id text REFERENCES marketplace_accounts, platform platform
    );
    CREATE TABLE imports (
      id text PRIMARY KEY, marketplace_account_id text REFERENCES marketplace_accounts,
      started_at timestamptz, finished_at timestamptz, status text, orders_processed integer
    );
  `);
});

after(async () => { await db?.close(); });

beforeEach(async () => {
  await db.exec(`
    TRUNCATE imports, orders, customers, marketplace_accounts;
    INSERT INTO marketplace_accounts VALUES
      ('ml-a', 'user-a', true), ('ml-a-2', 'user-a', true),
      ('magalu-a', 'user-a', true), ('old-a', 'user-a', false),
      ('ml-b', 'user-b', true), ('unowned', null, true);
    INSERT INTO customers VALUES
      ('customer-1', '5511999990000'), ('customer-2', null),
      ('customer-3', '5521888880000'), ('customer-4', null),
      ('customer-5', ''), ('orphan', '5511888880000'),
      ('foreign', '5511777770000'), ('unowned-customer', null);
    INSERT INTO orders VALUES
      ('1', 'customer-1', 'ml-a', 'MERCADO_LIVRE'),
      ('2', 'customer-1', 'ml-a', 'MERCADO_LIVRE'),
      ('3', 'customer-1', 'ml-a-2', 'MERCADO_LIVRE'),
      ('4', 'customer-1', 'magalu-a', 'MAGALU'),
      ('5', 'customer-2', 'ml-a', 'MERCADO_LIVRE'),
      ('6', 'customer-3', 'magalu-a', 'MAGALU'),
      ('7', 'customer-4', 'old-a', 'MERCADO_LIVRE'),
      ('8', 'customer-5', 'magalu-a', 'MAGALU'),
      ('9', 'foreign', 'ml-b', 'MERCADO_LIVRE'),
      ('10', 'unowned-customer', 'unowned', 'MERCADO_LIVRE'),
      ('11', 'customer-3', 'ml-b', 'MERCADO_LIVRE');
    INSERT INTO imports VALUES
      ('old', 'ml-a', '2026-09-01T12:00:00Z', '2026-09-01T12:01:00Z', 'SUCCESS', 5),
      ('latest-a', 'magalu-a', '2026-09-20T12:00:00Z', '2026-09-20T12:01:00Z', 'PARTIAL_SUCCESS', 9),
      ('latest-b', 'ml-b', '2026-10-01T12:00:00Z', null, 'PROCESSING', 3);
  `);
});

function setup() {
  const calls = { counts: 0, lastImport: 0, transactions: 0 };
  const readTransaction: DashboardReadTransaction = async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => {
    calls.transactions++;
    return db.transaction(async (pg) => {
      const tx = {
        $queryRaw: async (query: Prisma.Sql) => {
          calls.counts++;
          // Executa a consulta SQL efetiva do serviço em PostgreSQL embarcado.
          assert.equal(query.values.length, 1);
          assert.ok(!query.text.includes(String(query.values[0])));
          return (await pg.query(query.text, query.values)).rows;
        },
        import: {
          findFirst: async (args: Prisma.ImportFindFirstArgs) => {
            calls.lastImport++;
            assert.deepEqual(args.select, { startedAt: true, finishedAt: true, status: true, ordersProcessed: true });
            assert.deepEqual(args.orderBy, [{ startedAt: "desc" }, { id: "desc" }]);
            const where = args.where?.marketplaceAccount as Prisma.MarketplaceAccountWhereInput;
            assert.equal(typeof where.userId, "string");
            const result = await pg.query<Pick<Import, "startedAt" | "finishedAt" | "status" | "ordersProcessed">>(`
              SELECT i.started_at AS "startedAt", i.finished_at AS "finishedAt",
                i.status, i.orders_processed AS "ordersProcessed"
              FROM imports i JOIN marketplace_accounts a ON a.id = i.marketplace_account_id
              WHERE a.user_id = $1 ORDER BY i.started_at DESC, i.id DESC LIMIT 1
            `, [where.userId]);
            return result.rows[0] ?? null;
          },
        },
      };
      return work(tx as unknown as Prisma.TransactionClient);
    });
  };
  return { service: new DashboardService(readTransaction), calls };
}

test("conta clientes distintos de contas próprias em duas consultas, sem duplicar pessoas ou plataformas", async () => {
  const { service, calls } = setup();
  const result = await service.execute("user-a");
  assert.equal(result.totalCustomers, 5);
  assert.equal(result.customersWithPhone, 2);
  assert.equal(result.customersWithoutPhone, 3);
  assert.equal(result.mercadoLivreCustomers, 3);
  assert.equal(result.customersWithPhone + result.customersWithoutPhone, result.totalCustomers);
  assert.equal(result.lastImport?.status, "PARTIAL_SUCCESS");
  assert.equal(result.lastImport?.ordersProcessed, 9);
  assert.equal(result.lastImport?.startedAt.toISOString(), "2026-09-20T12:00:00.000Z");
  assert.deepEqual(calls, { counts: 1, lastImport: 1, transactions: 1 });
});

test("cada usuário recebe os próprios totais e a própria última importação", async () => {
  const { service } = setup();
  const result = await service.execute("user-b");
  assert.equal(result.totalCustomers, 2);
  assert.equal(result.customersWithPhone, 2);
  assert.equal(result.customersWithoutPhone, 0);
  assert.equal(result.mercadoLivreCustomers, 2);
  assert.equal(result.lastImport?.status, "PROCESSING");
  assert.equal(result.lastImport?.finishedAt, null);
});

test("usuário sem dados recebe zeros e lastImport null", async () => {
  const { service } = setup();
  assert.deepEqual(await service.execute("user-without-accounts"), {
    totalCustomers: 0, customersWithPhone: 0, customersWithoutPhone: 0,
    mercadoLivreCustomers: 0, lastImport: null,
  });
});

test("clientes sem importação registrada continuam aparecendo; lastImport é null", async () => {
  await db.exec("DELETE FROM imports WHERE marketplace_account_id <> 'ml-b'");
  const { service } = setup();
  const result = await service.execute("user-a");
  assert.equal(result.totalCustomers, 5);
  assert.equal(result.lastImport, null);
});

test("uma importação mais recente desconectada ou com erro permanece visível para seu dono", async () => {
  await db.exec(`INSERT INTO imports VALUES
    ('latest-error', 'old-a', '2026-09-30T12:00:00Z', '2026-09-30T12:01:00Z', 'ERROR', 0)`);
  const { service } = setup();
  const result = await service.execute("user-a");
  assert.equal(result.totalCustomers, 5);
  assert.equal(result.lastImport?.status, "ERROR");
  assert.equal(result.lastImport?.ordersProcessed, 0);
});

test("desempata importações com mesmo startedAt pelo ID", async () => {
  await db.exec(`INSERT INTO imports VALUES
    ('zzz', 'ml-a', '2026-09-20T12:00:00Z', null, 'PROCESSING', 7)`);
  const { service } = setup();
  assert.equal((await service.execute("user-a")).lastImport?.ordersProcessed, 7);
});

test("userId é parâmetro SQL; texto semelhante a injeção não amplia o acesso", async () => {
  const { service } = setup();
  const result = await service.execute("user-a' OR 1=1 --");
  assert.equal(result.totalCustomers, 0);
  assert.equal(result.mercadoLivreCustomers, 0);
  assert.equal(result.lastImport, null);
});

test("retorna somente os campos do contrato, sem dados de clientes ou credenciais", async () => {
  const { service } = setup();
  const result = await service.execute("user-a");
  assert.deepEqual(Object.keys(result).sort(), [
    "customersWithPhone", "customersWithoutPhone", "lastImport", "mercadoLivreCustomers", "totalCustomers",
  ]);
  assert.ok(result.lastImport);
  assert.deepEqual(Object.keys(result.lastImport).sort(), ["finishedAt", "ordersProcessed", "startedAt", "status"]);
});

test("usuário ausente é rejeitado antes de consultar o banco", async () => {
  const { service, calls } = setup();
  await assert.rejects(service.execute(""));
  assert.equal(calls.transactions, 0);
});

test("falha de banco não gera resumo falso nem expõe erro interno", async () => {
  const service = new DashboardService(async () => { throw new Error("SQL e informações privadas"); });
  await assert.rejects(service.execute("user-a"),
    (error: unknown) => error instanceof AppError && error.statusCode === 503 && !error.message.includes("SQL"));
});
