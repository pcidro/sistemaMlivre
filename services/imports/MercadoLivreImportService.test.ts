import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import type { MarketplaceCustomer, MarketplaceOrder } from "../../integrations/types";
import { MercadoLivreOrderService } from "../../integrations/mercadolivre/mercadoLivreOrderService";
import { ImportedOrderPersistenceService } from "./ImportedOrderPersistenceService";
import type { PersistImportedOrderInput } from "./ImportedOrderPersistenceService";
import type { ImportStorage, ImportSummary } from "./ImportRepository";
import { MercadoLivreImportService } from "./MercadoLivreImportService";
import { MemoryPersistenceDatabase } from "./testing/MemoryPersistenceDatabase";

const input = {
  marketplaceAccountId: "account-a", userId: "user-a",
  dateFrom: new Date("2026-09-01T00:00:00Z"), dateTo: new Date("2026-09-30T23:59:59Z"),
};
const xml = readFileSync("services/invoices/fixtures/nfe-with-phone.xml", "utf8");

function order(id: string): MarketplaceOrder {
  return {
    externalOrderId: id, platform: "MERCADO_LIVRE", status: "paid",
    orderDate: new Date("2026-09-10T12:00:00Z"),
    customer: { name: null, phone: null },
    items: [
      { externalProductId: "MLB1", productName: "Produto fictício A", quantity: 2, unitPrice: "10.00" },
      { externalProductId: "MLB2", productName: "Produto fictício B", quantity: 1, unitPrice: null },
    ],
  };
}

class MemoryImports implements ImportStorage {
  records: ImportSummary[] = [];
  updates: ImportSummary[] = [];
  async ownsActiveAccount(accountId: string, userId: string) {
    return accountId === "account-a" && userId === "user-a";
  }
  async create(accountId: string) {
    const record: ImportSummary = {
      id: `import-${this.records.length + 1}`, marketplaceAccountId: accountId,
      status: "PROCESSING", startedAt: new Date(), finishedAt: null,
      ordersFound: 0, ordersProcessed: 0, customersWithPhone: 0, customersWithoutPhone: 0, errorsCount: 0,
    };
    this.records.push(record);
    return { ...record };
  }
  async update(id: string, data: Parameters<ImportStorage["update"]>[1]) {
    const record = this.records.find((row) => row.id === id);
    assert.ok(record);
    Object.assign(record, data);
    this.updates.push({ ...record });
    return { ...record };
  }
}

function setup(pages: MarketplaceOrder[][] = [[order("1"), order("2")]]) {
  const storage = new MemoryImports();
  const saved: PersistImportedOrderInput[] = [];
  const invoiceCalls: string[] = [];
  const dependencies = {
    storage,
    orders: { async *getOrders() {
      assert.equal(storage.records.at(-1)?.status, "PROCESSING");
      for (const page of pages) yield page;
    } },
    recipients: { async getRecipient(_accountId: string, current: Pick<MarketplaceOrder, "externalOrderId" | "customer">): Promise<MarketplaceCustomer> {
      return { name: "Maria Fictícia", phone: current.externalOrderId === "1" ? "11999990000" : null,
        document: current.externalOrderId === "1" ? "12345678900" : null };
    } },
    invoices: { async getInvoiceXml(request: { externalOrderId: string }) {
      invoiceCalls.push(request.externalOrderId);
      return null as string | null;
    } },
    persistence: { async execute(data: PersistImportedOrderInput) {
      saved.push(data);
      return {
        orderId: data.order.externalOrderId, customerId: "customer", invoiceId: null,
        created: true, itemsCount: data.order.items.length, customerHasPhone: data.order.customer.phone !== null,
      };
    } },
  };
  return { storage, saved, invoiceCalls, dependencies };
}

test("cria PROCESSING antes da busca, registra encontrados e conclui resumo SUCCESS", async () => {
  const { storage, saved, invoiceCalls, dependencies } = setup();
  const result = await new MercadoLivreImportService(dependencies).execute(input);
  assert.equal(result.status, "SUCCESS");
  assert.ok(result.finishedAt);
  assert.equal(result.ordersFound, 2);
  assert.equal(result.ordersProcessed, 2);
  assert.equal(result.customersWithPhone, 1);
  assert.equal(result.customersWithoutPhone, 1);
  assert.equal(result.errorsCount, 0);
  assert.equal(storage.updates[0]?.ordersProcessed, 0);
  assert.equal(storage.updates[0]?.ordersFound, 2);
  assert.deepEqual(invoiceCalls, ["2"]);
  assert.equal(saved[0]?.order.customer.phone, "5511999990000");
  assert.ok(saved.every((data) => data.marketplaceAccountId === input.marketplaceAccountId && data.userId === input.userId));
});

test("usa parser real uma vez, extrai telefone e passa somente dados fiscais à persistência", async () => {
  const { saved, dependencies } = setup([[order("2")]]);
  dependencies.invoices.getInvoiceXml = async () => xml;
  const result = await new MercadoLivreImportService(dependencies).execute(input);
  assert.equal(result.customersWithPhone, 1);
  assert.equal(result.customersWithoutPhone, 0);
  assert.ok(saved[0]?.invoice?.invoiceKey);
  assert.ok(saved[0]?.order.customer.phone?.startsWith("55"));
  assert.equal(JSON.stringify(saved).includes("<"), false);
});

test("pedido sem NF-e nem telefone é salvo e contado sem telefone", async () => {
  const { dependencies, saved } = setup([[order("2")]]);
  const result = await new MercadoLivreImportService(dependencies).execute(input);
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.customersWithoutPhone, 1);
  assert.equal(saved[0]?.invoice, null);
});

test("importa documento da NF-e mesmo quando pedido já informa telefone", async () => {
  const { saved, dependencies } = setup([[order("1")]]);
  dependencies.recipients.getRecipient = async () => ({ name: "Maria", phone: "11999999999", document: null });
  dependencies.invoices.getInvoiceXml = async () => xml;
  const result = await new MercadoLivreImportService(dependencies).execute(input);
  assert.equal(result.status, "SUCCESS");
  assert.equal(saved[0]?.order.customer.document, "00000000000");
  assert.equal(saved[0]?.order.customer.documentType, "CPF");
  assert.equal(saved[0]?.order.customer.phone, "5511999999999");
  assert.ok(saved[0]?.invoice);
});

for (const stage of ["recipient", "invoice", "xml", "persistence"] as const) {
  test(`falha em ${stage} produz PARTIAL_SUCCESS e não impede próximo pedido`, async () => {
    const { dependencies, saved } = setup([[order("2"), order("1")]]);
    if (stage === "recipient") dependencies.recipients.getRecipient = async (_id, current) => {
      if (current.externalOrderId === "2") throw new Error("dados privados fictícios");
      return { name: "Maria Fictícia", phone: "11999990000" };
    };
    if (stage === "invoice") dependencies.invoices.getInvoiceXml = async () => { throw new Error("token fictício"); };
    if (stage === "xml") dependencies.invoices.getInvoiceXml = async () => "<XML inválido";
    if (stage === "persistence") {
      const save = dependencies.persistence.execute;
      dependencies.persistence.execute = async (data) => {
        if (data.order.externalOrderId === "2") throw new Error("SQL privado fictício");
        return save(data);
      };
    }
    const result = await new MercadoLivreImportService({ ...dependencies, concurrency: 1 }).execute(input);
    assert.equal(result.status, "PARTIAL_SUCCESS");
    assert.equal(result.ordersFound, 2);
    const optionalInvoiceFailure = stage === "invoice" || stage === "xml";
    assert.equal(result.ordersProcessed, optionalInvoiceFailure ? 2 : 1);
    assert.equal(result.errorsCount, 1);
    assert.deepEqual(saved.map((data) => data.order.externalOrderId), optionalInvoiceFailure ? ["2", "1"] : ["1"]);
    assert.equal(JSON.stringify(result).includes("privado"), false);
  });
}

test("NF-e sem autorização preserva nome e pedido, com telefone/documento nulos e erro contabilizado", async () => {
  const { dependencies, saved } = setup([[order("2")]]);
  dependencies.invoices.getInvoiceXml = async () => { throw new AppError("Consulta fiscal sem permissão", 403); };
  const result = await new MercadoLivreImportService(dependencies).execute(input);
  assert.equal(result.status, "PARTIAL_SUCCESS");
  assert.equal(result.ordersProcessed, 1);
  assert.equal(result.errorsCount, 1);
  assert.equal(saved[0]?.order.customer.name, "Maria Fictícia");
  assert.equal(saved[0]?.order.customer.phone, null);
  assert.equal(saved[0]?.order.customer.document, null);
  assert.equal(saved[0]?.invoice, null);
});

test("todos os pedidos falham: ERROR, sem contagem de clientes salvos", async () => {
  const { dependencies } = setup();
  dependencies.persistence.execute = async () => { throw new Error("indisponível"); };
  const result = await new MercadoLivreImportService(dependencies).execute(input);
  assert.equal(result.status, "ERROR");
  assert.equal(result.ordersProcessed, 0);
  assert.equal(result.errorsCount, 2);
  assert.equal(result.customersWithPhone + result.customersWithoutPhone, 0);
});

for (const initialPage of [false, true]) {
  test(`falha de paginação ${initialPage ? "após sucesso" : "antes dos pedidos"} finaliza registro`, async () => {
    const { dependencies } = setup();
    dependencies.orders.getOrders = async function* () {
      if (initialPage) yield [order("1")];
      throw new Error("erro privado da API");
    };
    const result = await new MercadoLivreImportService(dependencies).execute(input);
    assert.equal(result.status, initialPage ? "PARTIAL_SUCCESS" : "ERROR");
    assert.equal(result.ordersFound, initialPage ? 1 : 0);
    assert.equal(result.ordersProcessed, initialPage ? 1 : 0);
    assert.equal(result.errorsCount, 1);
    assert.ok(result.finishedAt);
  });
}

test("período vazio termina SUCCESS com todos os contadores zerados", async () => {
  const { dependencies } = setup([]);
  const result = await new MercadoLivreImportService(dependencies).execute(input);
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.ordersFound + result.ordersProcessed + result.errorsCount, 0);
});

test("limita paralelismo e registra progresso entre lotes e páginas", async () => {
  const pages = [Array.from({ length: 23 }, (_, i) => order(String(i))), [order("24")]];
  const { dependencies, storage } = setup(pages);
  let active = 0;
  let peak = 0;
  dependencies.recipients.getRecipient = async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    return { name: "Cliente Fictício", phone: "11999990000" };
  };
  const result = await new MercadoLivreImportService({ ...dependencies, concurrency: 3, batchSize: 7 }).execute(input);
  assert.equal(peak, 3);
  assert.equal(result.ordersProcessed, 24);
  assert.ok(storage.updates.some((row) => row.ordersProcessed === 7));
  assert.ok(storage.updates.some((row) => row.ordersProcessed === 14));
  assert.ok(storage.updates.some((row) => row.ordersProcessed === 21));
});

test("IDs repetidos entre páginas são processados e contados somente uma vez", async () => {
  const { dependencies, saved } = setup([[order("1"), order("1")], [order("1"), order("2")]]);
  const result = await new MercadoLivreImportService(dependencies).execute(input);
  assert.equal(result.ordersFound, 2);
  assert.equal(result.ordersProcessed, 2);
  assert.equal(saved.length, 2);
});

test("não cria importação nem consulta API para conta de outro usuário", async () => {
  const { dependencies, storage } = setup();
  await assert.rejects(new MercadoLivreImportService(dependencies).execute({ ...input, userId: "user-b" }),
    (error: unknown) => error instanceof AppError && error.statusCode === 404);
  assert.equal(storage.records.length, 0);
});

test("valida período antes de criar registro", async () => {
  const { dependencies, storage } = setup();
  const service = new MercadoLivreImportService(dependencies);
  await assert.rejects(service.execute({ ...input, dateFrom: input.dateTo, dateTo: input.dateFrom }));
  await assert.rejects(service.execute({ ...input, dateFrom: new Date("inválida") }));
  assert.equal(storage.records.length, 0);
});

test("bloqueia importações simultâneas da mesma conta e libera após concluir", async () => {
  const { dependencies, storage } = setup();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  dependencies.orders.getOrders = async function* () { await gate; yield [order("1")]; };
  const service = new MercadoLivreImportService(dependencies);
  const first = service.execute(input);
  while (storage.records.length === 0) await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(service.execute(input), (error: unknown) => error instanceof AppError && error.statusCode === 409);
  release();
  await first;
  await service.execute(input);
  assert.equal(storage.records.length, 2);
});

test("falha ao finalizar é devolvida como erro seguro, sem resumo fictício de sucesso", async () => {
  const { dependencies } = setup([]);
  dependencies.storage.update = async () => { throw new Error("SQL e informações privadas"); };
  await assert.rejects(new MercadoLivreImportService(dependencies).execute(input),
    (error: unknown) => error instanceof AppError && error.statusCode === 503 && !error.message.includes("SQL"));
});

test("coordena extração e persistência reais: reimportação mantém um pedido, nota e produtos", async () => {
  const { dependencies, storage } = setup([[order("2")]]);
  const db = new MemoryPersistenceDatabase();
  dependencies.invoices.getInvoiceXml = async () => xml;
  const persistence = new ImportedOrderPersistenceService({ runTransaction: db.runTransaction });
  const service = new MercadoLivreImportService({ ...dependencies, persistence, concurrency: 1 });
  await service.execute(input);
  await service.execute(input);
  assert.equal(db.state.orders.length, 1);
  assert.equal(db.state.invoices.length, 1);
  assert.equal(db.state.customers.length, 1);
  assert.equal(db.state.items.length, 2);
  assert.equal(storage.records.length, 2);
  assert.ok(storage.records.every((row) => row.ordersProcessed === 1 && row.status === "SUCCESS"));
});

test("contador considera telefone preservado no banco quando a fonte atual não o informa", async () => {
  const { dependencies } = setup([[order("2")]]);
  const db = new MemoryPersistenceDatabase();
  const persistence = new ImportedOrderPersistenceService({ runTransaction: db.runTransaction });
  await persistence.execute({
    marketplaceAccountId: input.marketplaceAccountId, userId: input.userId,
    order: { ...order("2"), customer: { name: "Maria Fictícia", phone: "11999990000" } },
  });
  const result = await new MercadoLivreImportService({ ...dependencies, persistence }).execute(input);
  assert.equal(result.customersWithPhone, 1);
  assert.equal(result.customersWithoutPhone, 0);
  assert.equal(db.state.customers.length, 1);
});

for (const includeValid of [true, false]) {
  test(`pedido inválido na busca é contado e isolado (${includeValid ? "com outro válido" : "sozinho"})`, async () => {
    const { dependencies } = setup();
    const orders = new MercadoLivreOrderService({
      findOwnedAccount: async () => ({ id: input.marketplaceAccountId, externalAccountId: "123" }),
      nowFn: () => new Date("2026-10-01T12:00:00Z"),
      tokenService: {
        getValidAccessToken: async () => "fictício", refreshAccessToken: async () => "fictício",
      },
      fetchFn: async () => {
        const results = [
          { id: "2", date_created: "inválida" },
          ...(includeValid ? [{ id: "1", date_created: "2026-09-10T12:00:00Z", order_items: [] }] : []),
        ];
        return new Response(JSON.stringify({ results, paging: { total: results.length, offset: 0, limit: 50 } }));
      },
    });
    const result = await new MercadoLivreImportService({ ...dependencies, orders }).execute(input);
    assert.equal(result.status, includeValid ? "PARTIAL_SUCCESS" : "ERROR");
    assert.equal(result.ordersFound, includeValid ? 2 : 1);
    assert.equal(result.ordersProcessed, includeValid ? 1 : 0);
    assert.equal(result.errorsCount, 1);
  });
}
