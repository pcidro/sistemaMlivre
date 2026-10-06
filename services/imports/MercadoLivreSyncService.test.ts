import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../../errors/AppError";
import { MercadoLivreSyncRepository, MercadoLivreSyncService, type MercadoLivreSyncStorage } from "./MercadoLivreSyncService";
import type { ImportSummary } from "./ImportRepository";
import type { prisma } from "../../lib/prisma";

const now = new Date("2026-10-06T12:00:00Z");
const summary: ImportSummary = { id: "job", marketplaceAccountId: "account", status: "PROCESSING", startedAt: now, finishedAt: null,
  ordersFound: 0, ordersProcessed: 0, customersWithPhone: 0, customersWithoutPhone: 0, errorsCount: 0 };

function setup(status: ImportSummary["status"] = "SUCCESS") {
  const scheduled: (() => Promise<void>)[] = [];
  const events: string[] = [];
  const input = { marketplaceAccountId: "account", userId: "owner", dateFrom: new Date("2026-07-08T12:00:00Z"), dateTo: now };
  const storage: MercadoLivreSyncStorage = {
    async register(accountId, userId, days) {
      assert.equal(accountId, "account"); assert.equal(userId, "owner"); assert.ok(days > 0);
      events.push("register"); return { summary, input };
    },
    async checkpoint(accountId, userId, dateTo) { assert.equal(accountId, "account"); assert.equal(userId, "owner"); assert.equal(dateTo, now); events.push("checkpoint"); },
    async fail() { events.push("failed"); }, async get() { return summary; }, async list() { return [summary]; },
  };
  const importer = { async execute(received: typeof input, record?: ImportSummary) {
    assert.deepEqual(received, input); assert.equal(record, summary); events.push("process");
    return { ...summary, status, finishedAt: new Date(now.getTime() + 60_000) };
  } };
  const service = new MercadoLivreSyncService(storage, importer, work => { scheduled.push(work); }, () => now);
  return { scheduled, events, storage, importer, service, input };
}

test("registra antes de devolver PROCESSING, não espera pedidos e avança até dateTo, nunca finishedAt", async () => {
  const fixture = setup();
  assert.equal((await fixture.service.start("account", "owner")).status, "PROCESSING");
  assert.deepEqual(fixture.events, ["register"]);
  await fixture.scheduled[0]!();
  assert.deepEqual(fixture.events, ["register", "process", "checkpoint"]);
});

for (const status of ["PARTIAL_SUCCESS", "ERROR"] as const) {
  test(`${status} não avança cursor e conserva dados/conta`, async () => {
    const fixture = setup(status);
    await fixture.service.start("account", "owner"); await fixture.scheduled[0]!();
    assert.deepEqual(fixture.events, ["register", "process"]);
  });
}

test("reconexão reutiliza job ativo sem agendar outra execução", async () => {
  const fixture = setup();
  fixture.storage.register = async () => ({ summary, input: null });
  await fixture.service.start("account", "owner");
  assert.equal(fixture.scheduled.length, 0);
});

test("erro fatal marca apenas Import e só registra identificador seguro", async context => {
  const fixture = setup();
  fixture.importer.execute = async () => { throw new Error("token-cpf-telefone-privados"); };
  const logger = context.mock.method(console, "error", () => {});
  await fixture.service.start("account", "owner"); await fixture.scheduled[0]!();
  assert.deepEqual(fixture.events, ["register", "failed"]);
  assert.deepEqual(logger.mock.calls[0]?.arguments, ["mercadolivre_sync_failed", { importId: "job" }]);
});

test("leitura de importação inacessível retorna 404", async () => {
  const fixture = setup(); fixture.storage.get = async () => null;
  await assert.rejects(fixture.service.get("job", "other"), error => error instanceof AppError && error.statusCode === 404);
});

test("período configurável, padrão 90, recusa configuração inválida antes de criar job", async () => {
  const previous = process.env.MERCADO_LIVRE_INITIAL_SYNC_DAYS;
  const fixture = setup(); const periods: number[] = [];
  fixture.storage.register = async (_account, _owner, days) => { periods.push(days); return { summary, input: null }; };
  try {
    delete process.env.MERCADO_LIVRE_INITIAL_SYNC_DAYS;
    await fixture.service.start("account", "owner");
    process.env.MERCADO_LIVRE_INITIAL_SYNC_DAYS = "30";
    await fixture.service.start("account", "owner");
    for (const value of ["", "abc", "0", "366", "1.5"]) {
      process.env.MERCADO_LIVRE_INITIAL_SYNC_DAYS = value;
      await assert.rejects(fixture.service.start("account", "owner"));
    }
    assert.deepEqual(periods, [90, 30]);
  } finally {
    if (previous === undefined) delete process.env.MERCADO_LIVRE_INITIAL_SYNC_DAYS;
    else process.env.MERCADO_LIVRE_INITIAL_SYNC_DAYS = previous;
  }
});

function repositoryFixture(options: { cursor?: Date; previousStart?: Date; active?: boolean; owned?: boolean } = {}) {
  const writes: Record<string, unknown>[] = [];
  const tx = {
    marketplaceAccount: {
      async updateMany() { return { count: options.owned === false ? 0 : 1 }; },
      async findUniqueOrThrow() { return { lastSyncAt: options.cursor ?? null }; },
    },
    import: {
      async findFirst(args: { where: { status?: string } }) {
        return args.where.status ? options.active ? summary : null : options.previousStart ? { dateFrom: options.previousStart, status: "PARTIAL_SUCCESS" } : null;
      },
      async create(args: { data: Record<string, unknown> }) { writes.push(args.data); return summary; },
    },
  };
  const database = { import: { async updateMany() { return { count: 0 }; } }, async $transaction<T>(work: (client: typeof tx) => Promise<T>) { return work(tx); } };
  const repository = new MercadoLivreSyncRepository(database as unknown as typeof prisma);
  return { repository, writes };
}

test("primeira sincronização limita a 90 dias; reconexão incremental inclui uma hora de sobreposição", async () => {
  const first = repositoryFixture();
  const initial = await first.repository.register("account", "owner", 90, now);
  assert.equal(initial.input?.dateFrom.toISOString(), "2026-07-08T12:00:00.000Z");
  const next = repositoryFixture({ cursor: new Date("2026-10-05T12:00:00Z") });
  const incremental = await next.repository.register("account", "owner", 90, now);
  assert.equal(incremental.input?.dateFrom.toISOString(), "2026-10-05T11:00:00.000Z");
  assert.equal(incremental.input?.dateTo, now);
  assert.equal(first.writes[0]?.automatic, true);
});

test("retry inicial parcial mantém a data original em vez de encurtar histórico", async () => {
  const previousStart = new Date("2026-07-01T12:00:00Z");
  const fixture = repositoryFixture({ previousStart });
  assert.equal((await fixture.repository.register("account", "owner", 30, now)).input?.dateFrom.getTime(), previousStart.getTime());
});

test("repository impede criação em conta alheia/inativa e reutiliza PROCESSING", async () => {
  const inaccessible = repositoryFixture({ owned: false });
  await assert.rejects(inaccessible.repository.register("account", "other", 90, now), error => error instanceof AppError && error.statusCode === 404);
  assert.equal(inaccessible.writes.length, 0);
  const active = repositoryFixture({ active: true });
  assert.equal((await active.repository.register("account", "owner", 90, now)).input, null);
  assert.equal(active.writes.length, 0);
});

test("leitura recupera apenas ML PROCESSING expirado do dono e nunca seleciona tokens/dados pessoais", async () => {
  const calls: { method: string; args: unknown }[] = [];
  const database = {
    import: {
      async updateMany(args: unknown) { calls.push({ method: "recover", args }); return { count: 1 }; },
      async findFirst(args: unknown) { calls.push({ method: "get", args }); return { ...summary, status: "ERROR", errorsCount: 1 }; },
    },
  };
  const repository = new MercadoLivreSyncRepository(database as unknown as typeof prisma);
  assert.equal((await repository.get("job", "owner"))?.status, "ERROR");
  const recovery = calls[0]?.args as { where: { platform: string; status: string; marketplaceAccount: { userId: string }; updatedAt: { lt: Date } }; data: { status: string } };
  assert.equal(recovery.where.platform, "MERCADO_LIVRE");
  assert.equal(recovery.where.status, "PROCESSING");
  assert.deepEqual(recovery.where.marketplaceAccount, { userId: "owner" });
  assert.ok(Math.abs(recovery.where.updatedAt.lt.getTime() - (Date.now() - 600_000)) < 1000);
  assert.equal(recovery.data.status, "ERROR");
  const query = calls[1]?.args as { where: unknown; select: unknown };
  assert.deepEqual(query.where, { id: "job", platform: "MERCADO_LIVRE", marketplaceAccount: { userId: "owner" } });
  assert.deepEqual(Object.keys(query.select as object).sort(), Object.keys(summary).sort());
});

test("checkpoint só cresce e só pode atualizar conta ativa do mesmo dono", async () => {
  let query: unknown;
  const database = { marketplaceAccount: { async updateMany(args: unknown) { query = args; return { count: 1 }; } } };
  await new MercadoLivreSyncRepository(database as unknown as typeof prisma).checkpoint("account", "owner", now);
  assert.deepEqual(query, {
    where: { id: "account", userId: "owner", platform: "MERCADO_LIVRE", isActive: true, OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: now } }] },
    data: { lastSyncAt: now },
  });
});
