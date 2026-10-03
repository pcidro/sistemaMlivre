import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import { MagaluClient } from "../../integrations/magalu/MagaluClient";
import { MagaluCustomerService } from "../../integrations/magalu/MagaluCustomerService";
import { MagaluDeliveryService } from "../../integrations/magalu/MagaluDeliveryService";
import { MagaluInvoiceService } from "../../integrations/magalu/MagaluInvoiceService";
import { MagaluHttpError } from "../../integrations/magalu/magaluHttpError";
import { getMagaluConfig } from "../../integrations/magalu/magaluConfig";
import { MagaluOrderService } from "../../integrations/magalu/MagaluOrderService";
import { MagaluRequestLimiter } from "../../integrations/magalu/MagaluRequestLimiter";
import { magaluOrderFixtures } from "../../integrations/magalu/fixtures/magaluOrders";
import { invoiceFixture } from "../../integrations/magalu/fixtures/magaluInvoices";
import { oauthTestConfig } from "../../integrations/magalu/magaluOAuthTestSupport";
import type { MagaluTokenAccount } from "../../integrations/magalu/magaluTokenStorage";
import type { MarketplaceOrder } from "../../integrations/types";
import type { ImportStorage, ImportSummary } from "./ImportRepository";
import { ImportedOrderPersistenceService } from "./ImportedOrderPersistenceService";
import { MagaluImportService } from "./MagaluImportService";
import { MagaluOrderImportService } from "./MagaluOrderImportService";
import type { ImportMagaluOrderInput } from "./MagaluOrderImportService";
import { MemoryPersistenceDatabase } from "./testing/MemoryPersistenceDatabase";

const input = { marketplaceAccountId: "account-a", userId: "user-a",
  dateFrom: new Date("2026-09-01T00:00:00Z"), dateTo: new Date("2026-09-30T23:59:59.999Z") };

function order(id: string, phone: string | null = "5511900000001"): MarketplaceOrder {
  return { externalOrderId: id, platform: "MAGALU", status: "approved", orderDate: new Date("2026-09-10T12:00:00Z"),
    customer: { name: "Cliente de teste", phone, document: "00000000000", documentType: "CPF" },
    items: [{ externalProductId: "SKU-TESTE", productName: "Produto de teste", quantity: 1, unitPrice: "19.90" }] };
}

class MemoryImports implements ImportStorage {
  records: ImportSummary[] = [];
  updates: ImportSummary[] = [];
  async ownsActiveAccount(id: string, userId: string) { return ["account-a", "account-b"].includes(id) && userId === input.userId; }
  async create(accountId: string) {
    const record: ImportSummary = { id: `import-${this.records.length + 1}`, marketplaceAccountId: accountId,
      status: "PROCESSING", startedAt: new Date(), finishedAt: null,
      ordersFound: 0, ordersProcessed: 0, customersWithPhone: 0, customersWithoutPhone: 0, errorsCount: 0 };
    this.records.push(record); return { ...record };
  }
  async update(id: string, data: Parameters<ImportStorage["update"]>[1]) {
    const record = this.records.find(record => record.id === id); assert.ok(record);
    Object.assign(record, data); this.updates.push({ ...record }); return { ...record };
  }
}

function setup(pages = [[order("1"), order("2", null)]]) {
  const storage = new MemoryImports();
  const saved: ImportMagaluOrderInput[] = [];
  const users: string[] = [];
  const dependencies = {
    storage,
    orders: { async *getOrders(request: Parameters<MagaluOrderService["getOrders"]>[0]) {
      assert.equal(storage.records.at(-1)?.status, "PROCESSING");
      assert.equal(request.marketplaceAccountId, input.marketplaceAccountId);
      assert.equal(request.dateFrom.getTime(), input.dateFrom.getTime());
      assert.equal(request.dateTo.getTime(), input.dateTo.getTime());
      for (const page of pages) yield page;
    } },
    createOrderImporter: (userId: string) => { users.push(userId); return { async execute(data: ImportMagaluOrderInput) {
      saved.push(data);
      return { orderId: data.order.externalOrderId, customerId: "customer", invoiceId: null, invoiceIds: [],
        created: true, itemsCount: data.order.items.length, customerHasPhone: data.order.customer.phone !== null };
    } }; },
  };
  return { storage, saved, users, dependencies };
}

test("PROCESSING antecede busca; progresso e contadores concluem SUCCESS", async () => {
  const fixture = setup();
  const result = await new MagaluImportService(fixture.dependencies).execute(input);
  assert.equal(result.status, "SUCCESS"); assert.ok(result.finishedAt);
  assert.deepEqual([result.ordersFound, result.ordersProcessed, result.customersWithPhone, result.customersWithoutPhone, result.errorsCount], [2, 2, 1, 1, 0]);
  assert.equal(fixture.storage.updates[0]?.ordersProcessed, 0);
  assert.equal(fixture.storage.updates[0]?.ordersFound, 2);
  assert.ok(fixture.users.every(user => user === input.userId));
  assert.ok(fixture.saved.every(data => data.marketplaceAccountId === input.marketplaceAccountId));
});

test("período sem pedidos conclui SUCCESS com contadores zerados", async () => {
  const fixture = setup([]);
  const result = await new MagaluImportService(fixture.dependencies).execute(input);
  assert.equal(result.status, "SUCCESS");
  assert.deepEqual([result.ordersFound, result.ordersProcessed, result.customersWithPhone, result.customersWithoutPhone, result.errorsCount], [0, 0, 0, 0, 0]);
});

test("um pedido com erro não cancela os demais e produz PARTIAL_SUCCESS", async () => {
  const fixture = setup([[order("ruim"), order("bom")], [order("depois")]]);
  const original = fixture.dependencies.createOrderImporter;
  fixture.dependencies.createOrderImporter = user => ({ async execute(data) {
    if (data.order.externalOrderId === "ruim") throw new Error("SQL TOKEN DADOS-SENSIVEIS");
    return original(user).execute(data);
  } });
  const result = await new MagaluImportService({ ...fixture.dependencies, concurrency: 1 }).execute(input);
  assert.equal(result.status, "PARTIAL_SUCCESS"); assert.equal(result.errorsCount, 1);
  assert.equal(result.ordersProcessed, 2); assert.equal(result.ordersFound, 3);
  assert.deepEqual(fixture.saved.map(data => data.order.externalOrderId), ["bom", "depois"]);
  assert.ok(!JSON.stringify(result).includes("SENSIVEIS"));
});

test("todos os pedidos falham: ERROR sem clientes processados", async () => {
  const fixture = setup();
  fixture.dependencies.createOrderImporter = () => ({ async execute() { throw new Error("Falha"); } });
  const result = await new MagaluImportService(fixture.dependencies).execute(input);
  assert.equal(result.status, "ERROR"); assert.equal(result.errorsCount, 2); assert.equal(result.ordersProcessed, 0);
  assert.equal(result.customersWithPhone + result.customersWithoutPhone, 0);
});

test("erro opcional de fallback é contado uma vez por pedido salvo", async () => {
  const fixture = setup([[order("1")]]);
  const original = fixture.dependencies.createOrderImporter;
  fixture.dependencies.createOrderImporter = user => ({ async execute(data) {
    data.onFallbackError?.(new MagaluHttpError("Falha fiscal segura", 503, "unavailable"));
    data.onFallbackError?.(new MagaluHttpError("Outra falha fiscal segura", 503, "unavailable"));
    return original(user).execute(data);
  } });
  const result = await new MagaluImportService(fixture.dependencies).execute(input);
  assert.equal(result.status, "PARTIAL_SUCCESS"); assert.equal(result.errorsCount, 1); assert.equal(result.ordersProcessed, 1);
});

test("erro fiscal seguido de falha de persistência não conta duas falhas para o mesmo pedido", async () => {
  const fixture = setup([[order("1")]]);
  fixture.dependencies.createOrderImporter = () => ({ async execute(data) {
    data.onFallbackError?.(new MagaluHttpError("Falha fiscal", 503, "unavailable")); throw new Error("Falha de gravação");
  } });
  const result = await new MagaluImportService(fixture.dependencies).execute(input);
  assert.equal(result.status, "ERROR"); assert.equal(result.errorsCount, 1);
});

for (const successfulPage of [false, true]) {
  test(`erro de paginação ${successfulPage ? "depois" : "antes"} de processar pedidos finaliza Import`, async () => {
    const fixture = setup();
    fixture.dependencies.orders.getOrders = async function* () { if (successfulPage) yield [order("1")]; throw new Error("TOKEN-SENSIVEL"); };
    const result = await new MagaluImportService(fixture.dependencies).execute(input);
    assert.equal(result.status, successfulPage ? "PARTIAL_SUCCESS" : "ERROR");
    assert.equal(result.ordersProcessed, successfulPage ? 1 : 0); assert.equal(result.errorsCount, 1); assert.ok(result.finishedAt);
  });
}

test("IDs repetidos entre páginas não duplicam processamento nem contagem", async () => {
  const fixture = setup([[order("1"), order("1")], [order("1"), order("2")]]);
  const result = await new MagaluImportService(fixture.dependencies).execute(input);
  assert.equal(result.ordersFound, 2); assert.equal(result.ordersProcessed, 2); assert.equal(fixture.saved.length, 2);
});

test("limita concorrência e registra progresso entre batches antes de pedir próxima página", async () => {
  const fixture = setup([Array.from({ length: 9 }, (_, index) => order(String(index)))]);
  let active = 0; let max = 0; let processed = 0;
  const original = fixture.dependencies.createOrderImporter;
  fixture.dependencies.createOrderImporter = user => ({ async execute(data) {
    active++; max = Math.max(max, active);
    await new Promise<void>(resolve => setImmediate(resolve));
    const result = await original(user).execute(data); active--; processed++; return result;
  } });
  fixture.dependencies.orders.getOrders = async function* () {
    yield Array.from({ length: 9 }, (_, index) => order(String(index)));
    assert.equal(processed, 9); yield [order("último")];
  };
  const result = await new MagaluImportService({ ...fixture.dependencies, concurrency: 2, batchSize: 3 }).execute(input);
  assert.equal(max, 2); assert.equal(result.ordersProcessed, 10);
  assert.ok(fixture.storage.updates.some(update => update.ordersProcessed === 3));
  assert.ok(fixture.storage.updates.some(update => update.ordersProcessed === 6));
});

test("conta de outro usuário não cria Import nem consulta API", async () => {
  const fixture = setup();
  await assert.rejects(new MagaluImportService(fixture.dependencies).execute({ ...input, userId: "outro" }),
    error => error instanceof AppError && error.statusCode === 404);
  assert.equal(fixture.storage.records.length, 0); assert.equal(fixture.saved.length, 0);
});

test("dados e intervalo inválidos falham antes de criar Import", async () => {
  for (const invalid of [{ ...input, dateFrom: input.dateTo, dateTo: input.dateFrom },
    { ...input, dateFrom: new Date("inválida") }, { ...input, userId: "" }]) {
    const fixture = setup();
    await assert.rejects(new MagaluImportService(fixture.dependencies).execute(invalid), AppError);
    assert.equal(fixture.storage.records.length, 0);
  }
});

test("rejeita configurações de concorrência/batch ilimitadas", () => {
  for (const config of [{ concurrency: 0 }, { concurrency: 11 }, { batchSize: 0 }, { batchSize: 51 }, { concurrency: Infinity }]) {
    assert.throws(() => new MagaluImportService(config));
  }
});

test("bloqueia a mesma conta simultaneamente e libera o bloqueio depois de concluir", async () => {
  const fixture = setup();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  fixture.dependencies.orders.getOrders = async function* () { await gate; yield [order("1")]; };
  const service = new MagaluImportService(fixture.dependencies);
  const first = service.execute(input);
  while (!fixture.storage.records.length) await new Promise<void>(resolve => setImmediate(resolve));
  await assert.rejects(service.execute(input), error => error instanceof AppError && error.statusCode === 409);
  release(); await first; await service.execute(input);
  assert.equal(fixture.storage.records.length, 2);
});

test("falha de gravação do resumo não retorna sucesso fictício nem mensagem do banco", async () => {
  const fixture = setup([]);
  fixture.storage.update = async () => { throw new Error("SQL TOKEN-SENSIVEL"); };
  await assert.rejects(new MagaluImportService(fixture.dependencies).execute(input), error =>
    error instanceof AppError && error.statusCode === 503 && !error.message.includes("SENSIVEL"));
});

function httpPipeline(api: (url: URL, call: number) => Response) {
  const storage = new MemoryImports();
  const db = new MemoryPersistenceDatabase(); db.state.accounts[0]!.platform = "MAGALU";
  const config = getMagaluConfig({ MAGALU_ENV: "sandbox" });
  const account: MagaluTokenAccount = { id: input.marketplaceAccountId, userId: input.userId, platform: "MAGALU", isActive: true,
    externalAccountId: "tenant-ficticio", accessTokenEncrypted: "provider-mockado", refreshTokenEncrypted: null, tokenExpiresAt: null };
  let now = Date.now();
  const delays: number[] = []; const urls: URL[] = [];
  const limiter = new MagaluRequestLimiter({ nowFn: () => now, sleepFn: async delay => { delays.push(delay); now += delay; } });
  const createClient = (owned: MagaluTokenAccount) => new MagaluClient(owned, {
    getConfig: () => config, getOAuthConfig: () => ({ ...oauthTestConfig, environment: "sandbox", audience: config.apiBaseUrl }),
    tokenService: { getAccessToken: async () => "token-ficticio" }, limiter, nowFn: () => now,
    fetchFn: async url => { const parsed = new URL(String(url)); urls.push(parsed); return api(parsed, urls.length); },
  });
  const dependencies = { findAccount: async () => account, createClient, getConfig: () => config };
  const customers = new MagaluCustomerService(input.userId, { findAccount: dependencies.findAccount,
    deliveries: new MagaluDeliveryService(input.userId, dependencies), invoices: new MagaluInvoiceService(input.userId, dependencies) });
  const persistence = new ImportedOrderPersistenceService({ runTransaction: db.runTransaction, sleepFn: async () => {} });
  const importer = new MagaluOrderImportService(input.userId, { customers, persistence });
  const service = new MagaluImportService({ storage, orders: new MagaluOrderService(input.userId, dependencies),
    createOrderImporter: () => importer, concurrency: 1 });
  return { service, db, storage, delays, urls };
}

function responsePage(url: URL, results: unknown[]) {
  return Response.json({ results, meta: { links: { self: url.search, next: null, previous: null }, page: {
    offset: Number(url.searchParams.get("_offset")), count: results.length,
    limit: Number(url.searchParams.get("_limit")), max_limit: 100,
  } } });
}

function rawOrder(code: string, phone = true) {
  return { ...magaluOrderFixtures.cpf, code, customer: { ...magaluOrderFixtures.cpf.customer,
    phones: phone ? [{ type: "mobile", country_code: "55", area_code: "11", number: "900000001" }] : [] } };
}

test("core real processa páginas e reimporta com persistência idempotente, sem consulta fiscal desnecessária", async () => {
  const fixture = httpPipeline(url => {
    assert.equal(url.pathname, "/seller/v1/orders");
    return responsePage(url, url.searchParams.get("_offset") === "0" ? [rawOrder("0001"), rawOrder("0002")] : []);
  });
  await fixture.service.execute(input); await fixture.service.execute(input);
  assert.equal(fixture.db.state.orders.length, 2); assert.equal(fixture.db.state.customers.length, 1);
  assert.equal(fixture.db.state.items.length, 2); assert.equal(fixture.db.state.invoices.length, 0);
  assert.equal(fixture.storage.records.length, 2);
  assert.ok(fixture.storage.records.every(record => record.status === "SUCCESS" && record.ordersProcessed === 2));
});

test("pedido inválido é isolado, contado e não impede páginas seguintes", async () => {
  const fixture = httpPipeline(url => responsePage(url, url.searchParams.get("_offset") === "0" ? [rawOrder("1"),
    { ...rawOrder("inválido"), purchased_at: "inválida", customer: { name: "DADO-SENSIVEL" } }]
    : url.searchParams.get("_offset") === "2" ? [rawOrder("2")] : []));
  const result = await fixture.service.execute(input);
  assert.equal(result.status, "PARTIAL_SUCCESS"); assert.equal(result.ordersFound, 3);
  assert.equal(result.ordersProcessed, 2); assert.equal(result.errorsCount, 1);
  assert.deepEqual(fixture.urls.map(url => url.searchParams.get("_offset")), ["0", "2", "3"]);
  assert.ok(!JSON.stringify(result).includes("SENSIVEL"));
});

test("página contendo somente pedido inválido produz ERROR sem erro de paginação adicional", async () => {
  const fixture = httpPipeline(url => responsePage(url, url.searchParams.get("_offset") === "0" ? [{ purchased_at: "inválida" }] : []));
  const result = await fixture.service.execute(input);
  assert.equal(result.status, "ERROR"); assert.equal(result.errorsCount, 1); assert.equal(result.ordersFound, 1);
});

test("429 transitório respeita Retry-After e conserva o mesmo offset sem duplicar encontrados", async () => {
  const fixture = httpPipeline((url, call) => call === 1 ? new Response(null, { status: 429, headers: { "Retry-After": "3" } })
    : responsePage(url, call === 2 ? [rawOrder("1")] : []));
  const result = await fixture.service.execute(input);
  assert.equal(result.status, "SUCCESS"); assert.equal(result.errorsCount, 0); assert.equal(result.ordersProcessed, 1);
  assert.deepEqual(fixture.urls.map(url => url.searchParams.get("_offset")), ["0", "0", "1"]);
  assert.ok(fixture.delays.reduce((sum, delay) => sum + delay, 0) >= 3000);
});

test("429 persistente encerra com ERROR após tentativas limitadas", async () => {
  const fixture = httpPipeline(() => new Response(null, { status: 429, headers: { "Retry-After": "1" } }));
  const result = await fixture.service.execute(input);
  assert.equal(result.status, "ERROR"); assert.equal(result.errorsCount, 1); assert.equal(fixture.urls.length, 3);
});

test("indisponibilidade intermediária preserva pedidos salvos e finaliza PARTIAL_SUCCESS", async () => {
  const fixture = httpPipeline((url, call) => call === 1 ? responsePage(url, [rawOrder("1")]) : new Response(null, { status: 503 }));
  const result = await fixture.service.execute(input);
  assert.equal(result.status, "PARTIAL_SUCCESS"); assert.equal(result.ordersProcessed, 1); assert.equal(result.errorsCount, 1);
  assert.equal(fixture.db.state.orders.length, 1); assert.equal(fixture.urls.length, 4);
});

test("core completo aplica fallback fiscal e salva a nota com o parser compartilhado", async () => {
  const fixture = httpPipeline(url => {
    if (url.pathname === "/seller/v1/orders") return responsePage(url, url.searchParams.get("_offset") === "0" ? [rawOrder("1", false)] : []);
    if (url.pathname === "/seller/v1/deliveries") return responsePage(url, [{
      id: "00000000-0000-4000-8000-000000000030", code: "1-1", status: "invoiced",
      order: { code: "1", channel: { id: getMagaluConfig({ MAGALU_ENV: "sandbox" }).channelId } },
    }]);
    assert.ok(url.pathname.endsWith("/invoices"));
    return responsePage(url, url.searchParams.get("_offset") === "0" ? [invoiceFixture()] : []);
  });
  const result = await fixture.service.execute(input);
  assert.equal(result.status, "SUCCESS"); assert.equal(result.customersWithPhone, 1);
  assert.equal(fixture.db.state.invoices.length, 1);
  assert.equal(fixture.db.state.customers[0]?.normalizedPhone, "5511999990000");
  assert.equal(fixture.db.state.customers[0]?.name, "Cliente CPF de teste");
});

test("NF-e indisponível por 403 mantém cliente e pedido, reportando PARTIAL_SUCCESS", async () => {
  const fixture = httpPipeline(url => {
    if (url.pathname === "/seller/v1/orders") return responsePage(url, url.searchParams.get("_offset") === "0" ? [rawOrder("1", false)] : []);
    if (url.pathname === "/seller/v1/deliveries") return responsePage(url, url.searchParams.get("_offset") === "0" ? [{
      id: "00000000-0000-4000-8000-000000000030", status: "invoiced",
      order: { code: "1", channel: { id: getMagaluConfig({ MAGALU_ENV: "sandbox" }).channelId } },
    }] : []);
    return Response.json({ segredo: "TOKEN-SENSIVEL" }, { status: 403 });
  });
  const result = await fixture.service.execute(input);
  assert.equal(result.status, "PARTIAL_SUCCESS"); assert.equal(result.ordersProcessed, 1); assert.equal(result.errorsCount, 1);
  assert.equal(result.customersWithoutPhone, 1); assert.equal(fixture.db.state.orders.length, 1);
  assert.ok(!JSON.stringify(result).includes("SENSIVEL"));
});

test("contadores refletem telefone preservado na reimportação mesmo se API atual não o fornece", async () => {
  const fixture = httpPipeline(url => url.pathname === "/seller/v1/orders"
    ? responsePage(url, url.searchParams.get("_offset") === "0" ? [rawOrder("1", false)] : []) : responsePage(url, []));
  const persistence = new ImportedOrderPersistenceService({ runTransaction: fixture.db.runTransaction });
  await persistence.execute({ marketplaceAccountId: input.marketplaceAccountId, userId: input.userId, order: order("1") });
  const result = await fixture.service.execute(input);
  assert.equal(result.status, "SUCCESS"); assert.equal(result.customersWithPhone, 1); assert.equal(result.customersWithoutPhone, 0);
});

for (const status of [401, 403, 429, 500, 503]) {
  for (const previousPage of [false, true]) {
    test(`revisão: HTTP ${status} ${previousPage ? "após página válida" : "na primeira página"} finaliza sem duplicar pedidos ou expor corpo`, async () => {
      const fixture = httpPipeline((url, call) => previousPage && call === 1
        ? responsePage(url, [rawOrder("review-1")])
        : Response.json({ access_token: "token-privado-ficticio", client_secret: "secret-privado-ficticio" }, { status }));
      const result = await fixture.service.execute(input);
      assert.equal(result.status, previousPage ? "PARTIAL_SUCCESS" : "ERROR");
      assert.equal(result.ordersFound, previousPage ? 1 : 0);
      assert.equal(result.ordersProcessed, previousPage ? 1 : 0);
      assert.equal(result.errorsCount, 1);
      assert.ok(result.finishedAt);
      assert.equal(fixture.db.state.orders.length, previousPage ? 1 : 0);
      const attempts = status === 401 ? 2 : status === 403 ? 1 : 3;
      assert.equal(fixture.urls.length, attempts + Number(previousPage));
      assert.ok(!JSON.stringify(result).includes("privado-ficticio"));
    });
  }
}

test("revisão: XML inválido preserva pedido sem telefone, não grava nota e permite processar o próximo", async () => {
  const fixture = httpPipeline(url => {
    if (url.pathname === "/seller/v1/orders") return responsePage(url,
      url.searchParams.get("_offset") === "0" ? [rawOrder("review-bad-xml", false), rawOrder("review-next")] : []);
    if (url.pathname === "/seller/v1/deliveries") return responsePage(url,
      url.searchParams.get("_offset") === "0" ? [{ id: "review-delivery", status: "invoiced",
        order: { code: "review-bad-xml", channel: { id: getMagaluConfig({ MAGALU_ENV: "sandbox" }).channelId } } }] : []);
    return responsePage(url, url.searchParams.get("_offset") === "0"
      ? [{ ...invoiceFixture(), xml: "<NFe><payload-invalido>" }] : []);
  });
  const result = await fixture.service.execute(input);
  assert.equal(result.status, "PARTIAL_SUCCESS");
  assert.deepEqual([result.ordersFound, result.ordersProcessed, result.errorsCount,
    result.customersWithPhone, result.customersWithoutPhone], [2, 2, 1, 1, 1]);
  assert.equal(fixture.db.state.invoices.length, 0);
  assert.equal(fixture.db.state.orders.length, 2);
  assert.ok(fixture.db.state.customers.every(customer => customer.document === "00000000000"));
});

test("revisão: sem documento, telefone e NF-e mantém cliente e idempotência do pedido", async () => {
  const source = rawOrder("review-missing", false);
  source.customer = { ...source.customer, document_number: null, customer_type: null };
  const fixture = httpPipeline(url => {
    if (url.pathname === "/seller/v1/orders") return responsePage(url, url.searchParams.get("_offset") === "0" ? [source] : []);
    if (url.pathname === "/seller/v1/deliveries") return responsePage(url,
      url.searchParams.get("_offset") === "0" ? [{ id: "review-delivery", status: "approved",
        order: { code: source.code, channel: { id: getMagaluConfig({ MAGALU_ENV: "sandbox" }).channelId } } }] : []);
    return new Response(null, { status: 404 });
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await fixture.service.execute(input);
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.ordersProcessed, 1); assert.equal(result.customersWithoutPhone, 1);
  }
  assert.equal(fixture.db.state.orders.length, 1);
  assert.equal(fixture.db.state.customers.length, 1);
  assert.equal(fixture.db.state.invoices.length, 0);
  assert.equal(fixture.db.state.customers[0]?.document, null);
  assert.equal(fixture.db.state.customers[0]?.normalizedPhone, null);
});
