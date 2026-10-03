import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import { MagaluCustomerService } from "../../integrations/magalu/MagaluCustomerService";
import { magaluOrderFixtures } from "../../integrations/magalu/fixtures/magaluOrders";
import { invoiceFixture, invoiceFixtureKey, secondInvoiceFixtureKey } from "../../integrations/magalu/fixtures/magaluInvoices";
import { getMagaluConfig } from "../../integrations/magalu/magaluConfig";
import { MagaluOrderMapper } from "../../integrations/magalu/MagaluOrderMapper";
import type { MagaluProcessedInvoice } from "../../integrations/magalu/magaluInvoice.types";
import type { MarketplaceDelivery } from "../../integrations/types";
import { NFeParserService } from "../invoices/NFeParserService";
import { ImportedOrderPersistenceService } from "./ImportedOrderPersistenceService";
import { MagaluOrderImportService } from "./MagaluOrderImportService";
import { MemoryPersistenceDatabase } from "./testing/MemoryPersistenceDatabase";

const userId = "user-a";
const accountId = "account-a";

function normalizedOrder(cnpj = false) {
  const fixture = structuredClone(cnpj ? magaluOrderFixtures.cnpj : magaluOrderFixtures.cpf);
  fixture.customer = { ...fixture.customer, phones: [{ country_code: "55", area_code: "11", number: "900000001", type: "mobile" }] };
  return new MagaluOrderMapper().map(fixture);
}

function parsedInvoice(options: Parameters<typeof invoiceFixture>[0] = {}): MagaluProcessedInvoice {
  const fixture = invoiceFixture(options);
  return { ...new NFeParserService().parse(fixture.xml), status: "approved", issuedAt: fixture.issued_at };
}

function setup(options: {
  invoices?: (MagaluProcessedInvoice | null | Error)[];
  noDeliveries?: boolean;
} = {}) {
  const db = new MemoryPersistenceDatabase();
  db.state.accounts[0]!.platform = "MAGALU";
  db.state.accounts[1]!.platform = "MAGALU";
  let deliveriesCalls = 0;
  let invoiceCalls = 0;
  const customers = new MagaluCustomerService(userId, {
    findAccount: async id => {
      const account = db.state.accounts.find(account => account.id === id);
      return account ? { ...account, externalAccountId: `tenant-ficticio-${id}`, accessTokenEncrypted: "nao-utilizado",
        refreshTokenEncrypted: null, tokenExpiresAt: null } : null;
    },
    deliveries: { async *getDeliveries(input) {
      deliveriesCalls++;
      if (options.noDeliveries) return;
      const invoices = options.invoices ?? [null];
      for (let index = 0; index < invoices.length; index++) {
        const delivery: MarketplaceDelivery = {
          marketplaceAccountId: input.marketplaceAccountId, externalOrderId: input.externalOrderId,
          externalDeliveryId: `delivery-${index}`, externalDeliveryCode: null, platform: "MAGALU",
          channelId: getMagaluConfig({ MAGALU_ENV: "sandbox" }).channelId, status: "invoiced",
        };
        yield [delivery];
      }
    } },
    invoices: { async getInvoice(input) {
      invoiceCalls++;
      const index = Number(input.delivery.externalDeliveryId.split("-")[1]);
      const invoice = options.invoices?.[index] ?? null;
      if (invoice instanceof Error) throw invoice;
      return invoice;
    } },
  });
  const persistence = new ImportedOrderPersistenceService({ runTransaction: db.runTransaction, sleepFn: async () => {} });
  const service = new MagaluOrderImportService(userId, { customers, persistence });
  return { db, service, persistence, customers, deliveriesCalls: () => deliveriesCalls, invoiceCalls: () => invoiceCalls };
}

test("primeiro import Magalu grava pedido por code, cliente e produtos pela persistência compartilhada", async () => {
  const fixture = setup();
  const order = normalizedOrder();
  const result = await fixture.service.execute({ marketplaceAccountId: accountId, order });
  assert.equal(result.created, true);
  assert.equal(fixture.db.state.orders.length, 1);
  assert.equal(fixture.db.state.customers.length, 1);
  assert.equal(fixture.db.state.items.length, 1);
  assert.equal(fixture.db.state.orders[0]?.externalOrderId, magaluOrderFixtures.cpf.code);
  assert.notEqual(fixture.db.state.orders[0]?.externalOrderId, magaluOrderFixtures.cpf.id);
  assert.equal(fixture.db.state.orders[0]?.platform, "MAGALU");
  assert.equal(fixture.db.state.orders[0]?.marketplaceAccountId, accountId);
  assert.equal(fixture.db.state.orders[0]?.customerId, result.customerId);
  assert.deepEqual(fixture.db.state.customers.map(customer => [customer.name, customer.phone, customer.normalizedPhone,
    customer.document, customer.documentType]), [["Cliente CPF de teste", "5511900000001", "5511900000001", "00000000000", "CPF"]]);
  assert.equal(fixture.db.state.items[0]?.orderId, result.orderId);
  assert.equal(fixture.db.state.items[0]?.productName, "Produto de teste");
  assert.equal(fixture.db.state.items[0]?.quantity, 2);
  assert.equal(fixture.db.state.items[0]?.unitPrice?.toFixed(2), "19.90");
  assert.equal(fixture.deliveriesCalls(), 0);
  assert.equal(fixture.invoiceCalls(), 0);
  assert.deepEqual(result.invoiceIds, []);
});

test("reimportação idêntica reutiliza IDs e não duplica clientes, pedidos ou itens", async () => {
  const fixture = setup();
  const input = { marketplaceAccountId: accountId, order: normalizedOrder() };
  const first = await fixture.service.execute(input);
  const before = { ...fixture.db.state };
  const second = await fixture.service.execute(input);
  assert.deepEqual(second, { ...first, created: false });
  assert.deepEqual(fixture.db.state, before);
});

for (const [cnpj, document, type] of [[false, "00000000000", "CPF"], [true, "00000000000000", "CNPJ"]] as const) {
  test(`cliente Magalu com ${type} mantém documento e tipo na reimportação`, async () => {
    const fixture = setup();
    const input = { marketplaceAccountId: accountId, order: normalizedOrder(cnpj) };
    const first = await fixture.service.execute(input);
    const second = await fixture.service.execute(input);
    assert.equal(second.customerId, first.customerId);
    assert.equal(fixture.db.state.customers.length, 1);
    assert.equal(fixture.db.state.customers[0]?.document, document);
    assert.equal(fixture.db.state.customers[0]?.documentType, type);
  });
}

test("cliente sem telefone e pedido sem NF-e são persistidos e reimportados normalmente", async () => {
  const fixture = setup();
  const order = normalizedOrder(); order.customer.phone = null;
  const input = { marketplaceAccountId: accountId, order };
  const first = await fixture.service.execute(input);
  const second = await fixture.service.execute(input);
  assert.equal(second.customerId, first.customerId);
  assert.equal(second.customerHasPhone, false);
  assert.equal(fixture.db.state.customers[0]?.phone, null);
  assert.equal(fixture.db.state.customers[0]?.normalizedPhone, null);
  assert.equal(fixture.db.state.orders.length, 1);
  assert.equal(fixture.db.state.invoices.length, 0);
});

test("pedido sem pacote fiscal continua podendo ser salvo", async () => {
  const fixture = setup({ noDeliveries: true });
  const order = normalizedOrder(); order.customer.phone = null;
  const result = await fixture.service.execute({ marketplaceAccountId: accountId, order });
  assert.equal(result.created, true);
  assert.equal(result.invoiceId, null);
  assert.equal(fixture.db.state.customers[0]?.name, order.customer.name);
});

test("NF-e processada complementa cliente e é persistida sem novo parsing, status, issuedAt ou XML", async () => {
  const invoice = parsedInvoice();
  const fixture = setup({ invoices: [invoice] });
  const order = normalizedOrder(); order.customer.phone = null;
  const first = await fixture.service.execute({ marketplaceAccountId: accountId, order });
  const second = await fixture.service.execute({ marketplaceAccountId: accountId, order });
  assert.equal(first.orderId, second.orderId);
  assert.equal(first.invoiceId, second.invoiceId);
  assert.deepEqual(second.invoiceIds, [first.invoiceId]);
  assert.equal(fixture.db.state.invoices.length, 1);
  assert.equal(fixture.db.state.invoices[0]?.invoiceKey, invoiceFixtureKey);
  assert.equal(fixture.db.state.invoices[0]?.invoiceNumber, "000000123");
  assert.equal(fixture.db.state.invoices[0]?.orderId, first.orderId);
  assert.equal(fixture.db.state.invoices[0]?.phone, "5511999990000");
  assert.equal(fixture.db.state.customers[0]?.normalizedPhone, "5511999990000");
  assert.equal(fixture.db.state.customers[0]?.name, order.customer.name);
  assert.equal(fixture.invoiceCalls(), 2); // Uma consulta por execução, sem segunda busca para persistir.
  assert.ok(!JSON.stringify(fixture.db.state.invoices).includes("xml"));
  assert.ok(!JSON.stringify(fixture.db.state.invoices).includes("issuedAt"));
});

test("NF-e com CNPJ utiliza o mesmo parser e a mesma persistência", async () => {
  const fixture = setup({ invoices: [parsedInvoice({ cnpj: true })] });
  const order = normalizedOrder(true); order.customer.phone = null;
  await fixture.service.execute({ marketplaceAccountId: accountId, order });
  assert.equal(fixture.db.state.customers[0]?.document, "00000000000000");
  assert.equal(fixture.db.state.customers[0]?.documentType, "CNPJ");
  assert.equal(fixture.db.state.invoices.length, 1);
});

test("NF-e sem telefone salva dados fiscais e mantém cliente sem telefone", async () => {
  const fixture = setup({ invoices: [parsedInvoice({ phone: false })] });
  const order = normalizedOrder(); order.customer.phone = null;
  await fixture.service.execute({ marketplaceAccountId: accountId, order });
  assert.equal(fixture.db.state.invoices.length, 1);
  assert.equal(fixture.db.state.invoices[0]?.phone, null);
  assert.equal(fixture.db.state.customers[0]?.normalizedPhone, null);
});

test("duas contas Magalu com mesmo order code criam pedidos independentes e reimportam por conta", async () => {
  const fixture = setup();
  const order = normalizedOrder();
  const a = await fixture.service.execute({ marketplaceAccountId: "account-a", order });
  const b = await fixture.service.execute({ marketplaceAccountId: "account-b", order });
  assert.notEqual(a.orderId, b.orderId);
  assert.equal(fixture.db.state.orders.length, 2);
  assert.equal(a.customerId, b.customerId); // Regra existente permite cliente compatível do mesmo usuário.
  assert.equal((await fixture.service.execute({ marketplaceAccountId: "account-a", order })).orderId, a.orderId);
  assert.equal((await fixture.service.execute({ marketplaceAccountId: "account-b", order })).orderId, b.orderId);
  assert.equal(fixture.db.state.orders.length, 2);
  assert.equal(fixture.db.state.items.length, 2);
});

test("nome igual sem telefone não deduplica clientes entre pedidos distintos", async () => {
  const fixture = setup();
  const a = normalizedOrder(); a.customer.phone = null;
  const b = { ...a, externalOrderId: "OUTRO-CODE" };
  await fixture.service.execute({ marketplaceAccountId: accountId, order: a });
  await fixture.service.execute({ marketplaceAccountId: accountId, order: b });
  assert.equal(fixture.db.state.customers.length, 2);
});

test("reimportação atualiza status e produtos sem acumular cópias", async () => {
  const fixture = setup();
  const order = normalizedOrder();
  const first = await fixture.service.execute({ marketplaceAccountId: accountId, order });
  order.status = "finished";
  order.items = [{ externalProductId: "SKU-ALTERADO", productName: "Produto atualizado", quantity: 3, unitPrice: "20.00" }];
  const second = await fixture.service.execute({ marketplaceAccountId: accountId, order });
  assert.equal(second.orderId, first.orderId);
  assert.equal(fixture.db.state.orders[0]?.status, "finished");
  assert.equal(fixture.db.state.items.length, 1);
  assert.equal(fixture.db.state.items[0]?.externalProductId, "SKU-ALTERADO");
  assert.equal(fixture.db.state.items[0]?.quantity, 3);
});

test("reimportação com dados ausentes não apaga dados conhecidos nem NF-e anterior", async () => {
  const fixture = setup({ invoices: [parsedInvoice()] });
  const order = normalizedOrder(); order.customer.phone = null;
  await fixture.service.execute({ marketplaceAccountId: accountId, order });
  const complete = normalizedOrder(); complete.customer.phone = "5511999990000";
  await fixture.service.execute({ marketplaceAccountId: accountId, order: complete });
  assert.equal(fixture.db.state.invoices.length, 1);
  assert.equal(fixture.invoiceCalls(), 1);
  complete.customer.phone = null;
  const absent = new MagaluOrderImportService(userId, { persistence: fixture.persistence, customers: {
    async getCustomerWithInvoices() { return { customer: { name: null, phone: null, document: null, documentType: null }, invoices: [] }; },
  } });
  await absent.execute({ marketplaceAccountId: accountId, order: complete });
  assert.equal(fixture.db.state.customers[0]?.normalizedPhone, "5511999990000");
  assert.equal(fixture.db.state.customers[0]?.document, "00000000000");
  assert.equal(fixture.db.state.invoices.length, 1);
});

test("falha fiscal não impede persistir os dados válidos do pedido", async () => {
  const fixture = setup({ invoices: [new Error("XML-SENSIVEL TOKEN-SENSIVEL")] });
  const order = normalizedOrder(); order.customer.phone = null;
  const result = await fixture.service.execute({ marketplaceAccountId: accountId, order });
  assert.equal(result.created, true);
  assert.equal(fixture.db.state.customers[0]?.document, "00000000000");
  assert.equal(fixture.db.state.invoices.length, 0);
});

test("vários pacotes processados persistem suas notas na mesma transação do pedido", async () => {
  const fixture = setup({ invoices: [parsedInvoice({ phone: false }), parsedInvoice({ key: secondInvoiceFixtureKey })] });
  const order = normalizedOrder(); order.customer.document = null; order.customer.documentType = null;
  const first = await fixture.service.execute({ marketplaceAccountId: accountId, order });
  assert.equal(fixture.db.transactionAttempts, 1);
  assert.equal(fixture.db.state.invoices.length, 2);
  assert.equal(first.invoiceIds?.length, 2);
  assert.ok(fixture.db.state.invoices.every(invoice => invoice.orderId === first.orderId));
  const second = await fixture.service.execute({ marketplaceAccountId: accountId, order });
  assert.deepEqual(second.invoiceIds, first.invoiceIds);
  assert.equal(fixture.db.state.invoices.length, 2);
});

test("mesma chave retornada em dois pacotes não duplica NF-e", async () => {
  const invoice = parsedInvoice();
  const fixture = setup({ invoices: [invoice, invoice] });
  const order = normalizedOrder(); order.customer.document = null; order.customer.documentType = null;
  const result = await fixture.service.execute({ marketplaceAccountId: accountId, order });
  assert.equal(fixture.db.state.invoices.length, 1);
  assert.equal(result.invoiceIds?.length, 1);
});

test("destinatários ambíguos não são enviados à persistência fiscal", async () => {
  const fixture = setup({ invoices: [parsedInvoice(), parsedInvoice({ key: secondInvoiceFixtureKey, document: "11111111111" })] });
  const order = normalizedOrder(); order.customer.document = null; order.customer.documentType = null;
  await fixture.service.execute({ marketplaceAccountId: accountId, order });
  assert.equal(fixture.db.state.customers[0]?.document, null);
  assert.equal(fixture.db.state.invoices.length, 0);
});

test("rollback de produtos reverte cliente, pedido e todas as notas selecionadas", async () => {
  const fixture = setup({ invoices: [parsedInvoice({ phone: false }), parsedInvoice({ key: secondInvoiceFixtureKey })] });
  const order = normalizedOrder(); order.customer.document = null; order.customer.documentType = null;
  fixture.db.failItemWrite = true;
  await assert.rejects(fixture.service.execute({ marketplaceAccountId: accountId, order }), error => error instanceof AppError && error.statusCode === 500);
  assert.equal(fixture.db.state.customers.length, 0);
  assert.equal(fixture.db.state.orders.length, 0);
  assert.equal(fixture.db.state.invoices.length, 0);
  assert.equal(fixture.db.state.items.length, 0);
});

test("conflito da segunda NF-e reverte a primeira nota e mantém o pedido anterior intacto", async () => {
  const fixture = setup({ invoices: [parsedInvoice(), parsedInvoice({ key: secondInvoiceFixtureKey })] });
  const previousOrder = normalizedOrder(); previousOrder.externalOrderId = "PEDIDO-ANTERIOR";
  const previous = await fixture.persistence.execute({ userId, marketplaceAccountId: accountId,
    order: previousOrder, invoice: new NFeParserService().parse(invoiceFixture({ key: secondInvoiceFixtureKey }).xml) });
  const order = normalizedOrder(); order.customer.document = null; order.customer.documentType = null;
  await assert.rejects(fixture.service.execute({ marketplaceAccountId: accountId, order }), error => error instanceof AppError && error.statusCode === 409);
  assert.equal(fixture.db.state.orders.length, 1);
  assert.equal(fixture.db.state.orders[0]?.id, previous.orderId);
  assert.equal(fixture.db.state.invoices.length, 1);
  assert.equal(fixture.db.state.invoices[0]?.invoiceKey, secondInvoiceFixtureKey);
});

test("conta de outra plataforma, usuário ou inativa não recebe pedidos Magalu", async () => {
  for (const change of ["platform", "user", "inactive"]) {
    const fixture = setup();
    const savedAccount = fixture.db.state.accounts[0]!;
    if (change === "platform") savedAccount.platform = "MERCADO_LIVRE";
    if (change === "user") savedAccount.userId = "user-b";
    if (change === "inactive") savedAccount.isActive = false;
    await assert.rejects(fixture.service.execute({ marketplaceAccountId: accountId, order: normalizedOrder() }), AppError);
    assert.equal(fixture.db.state.orders.length, 0);
    assert.equal(fixture.db.transactionAttempts, 0);
  }
});

test("autorização é revalidada na transação mesmo com extração previamente concluída", async () => {
  const fixture = setup();
  const order = normalizedOrder();
  const extracted = await fixture.customers.getCustomerWithInvoices({ marketplaceAccountId: accountId, order });
  fixture.db.state.accounts[0]!.isActive = false;
  const service = new MagaluOrderImportService(userId, { persistence: fixture.persistence, customers: {
    async getCustomerWithInvoices() { return extracted; },
  } });
  await assert.rejects(service.execute({ marketplaceAccountId: accountId, order }), error => error instanceof AppError && error.statusCode === 404);
  assert.equal(fixture.db.state.customers.length, 0);
});

test("pedido Mercado Livre é recusado antes de extração ou escrita", async () => {
  const fixture = setup();
  const order = normalizedOrder(); order.platform = "MERCADO_LIVRE";
  await assert.rejects(fixture.service.execute({ marketplaceAccountId: accountId, order }), error => error instanceof AppError && error.statusCode === 422);
  assert.equal(fixture.db.transactionAttempts, 0);
});

test("conflitos de serialização reutilizam o retry limitado do serviço compartilhado", async () => {
  const fixture = setup({ invoices: [parsedInvoice()] });
  const order = normalizedOrder(); order.customer.phone = null;
  fixture.db.failuresBeforeCommit.push("P2034");
  await fixture.service.execute({ marketplaceAccountId: accountId, order });
  assert.equal(fixture.db.transactionAttempts, 2);
  assert.equal(fixture.db.state.orders.length, 1);
  assert.equal(fixture.db.state.invoices.length, 1);
  assert.equal(fixture.invoiceCalls(), 1);
});
