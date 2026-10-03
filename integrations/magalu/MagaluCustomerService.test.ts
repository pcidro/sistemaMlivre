import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import type { NormalizedCustomerData } from "../../services/customers/customerData";
import type { MarketplaceCustomer, MarketplaceDelivery, MarketplaceOrder } from "../types";
import { invoiceFixture, invoiceFixtureCpf } from "./fixtures/magaluInvoices";
import { MagaluCustomerService } from "./MagaluCustomerService";
import { MagaluCustomerExtractor } from "./MagaluCustomerExtractor";
import { MagaluDeliveryService } from "./MagaluDeliveryService";
import { MagaluInvoiceService } from "./MagaluInvoiceService";
import { MagaluClient } from "./MagaluClient";
import { getMagaluConfig } from "./magaluConfig";
import { MagaluHttpError } from "./magaluHttpError";
import type { MagaluProcessedInvoice } from "./magaluInvoice.types";
import { oauthTestConfig, testUserId, otherUserId, tenantId } from "./magaluOAuthTestSupport";
import { MagaluRequestLimiter } from "./MagaluRequestLimiter";
import type { MagaluTokenAccount } from "./magaluTokenStorage";

const accountId = "00000000-0000-4000-8000-000000000010";
const account: MagaluTokenAccount = {
  id: accountId, platform: "MAGALU", userId: testUserId, isActive: true, externalAccountId: tenantId,
  accessTokenEncrypted: "provider-mockado", refreshTokenEncrypted: null, tokenExpiresAt: new Date(Date.now() + 7200_000),
};
const primary: NormalizedCustomerData = { name: "Nome do pedido", phone: "5511999999999", document: "12345678900", documentType: "CPF" };
const empty: NormalizedCustomerData = { name: null, phone: null, document: null, documentType: null };
const secondary: MagaluProcessedInvoice = {
  invoiceKey: "35261000000000000100550010000001231000001234", invoiceNumber: "123",
  customerName: "Nome da NF-e", phone: "5511988888888", document: "12345678900", documentType: "CPF",
  status: "approved", issuedAt: "2026-10-01T10:00:00-03:00",
};
const delivery: MarketplaceDelivery = {
  marketplaceAccountId: accountId, platform: "MAGALU", externalOrderId: "PEDIDO-FICTICIO",
  externalDeliveryId: "00000000-0000-4000-8000-000000000030", externalDeliveryCode: null,
  channelId: getMagaluConfig({ MAGALU_ENV: "sandbox" }).channelId, status: "invoiced",
};
const secondDelivery = { ...delivery, externalDeliveryId: "00000000-0000-4000-8000-000000000031" };

function order(customer: MarketplaceCustomer): MarketplaceOrder {
  return { externalOrderId: delivery.externalOrderId, platform: "MAGALU", orderDate: null, status: "approved", customer, items: [] };
}

function setup(customer: MarketplaceCustomer = primary, options: {
  invoice?: MagaluProcessedInvoice | null;
  invoices?: Pick<MagaluInvoiceService, "getInvoice">;
  batches?: MarketplaceDelivery[][];
  deliveries?: Pick<MagaluDeliveryService, "getDeliveries">;
  account?: MagaluTokenAccount | null;
} = {}) {
  const calls: string[] = [];
  const sourceOrder = order(customer);
  const service = new MagaluCustomerService(testUserId, {
    findAccount: async id => { assert.equal(id, accountId); return options.account === undefined ? account : options.account; },
    deliveries: options.deliveries ?? { async *getDeliveries(input) {
      assert.deepEqual(input, { marketplaceAccountId: accountId, externalOrderId: delivery.externalOrderId });
      for (const [index, batch] of (options.batches ?? [[delivery]]).entries()) { calls.push(`batch:${index}`); yield batch; }
    } },
    invoices: { getInvoice: async input => {
      calls.push(input.delivery.externalDeliveryId);
      return options.invoices ? options.invoices.getInvoice(input) : options.invoice === undefined ? secondary : options.invoice;
    } },
  });
  return { service, input: { marketplaceAccountId: accountId, order: sourceOrder }, calls };
}

// Todas as combinações de presença de nome/telefone/documento nas duas fontes.
for (let sourceMask = 0; sourceMask < 8; sourceMask++) {
  for (let invoiceMask = 0; invoiceMask < 8; invoiceMask++) {
    test(`prioridade por campo: pedido=${sourceMask}, NF-e=${invoiceMask}`, async () => {
      const customer = {
        name: sourceMask & 1 ? primary.name : null,
        phone: sourceMask & 2 ? primary.phone : null,
        document: sourceMask & 4 ? primary.document : null,
        documentType: sourceMask & 4 ? primary.documentType : null,
      };
      const invoice = {
        ...secondary, customerName: invoiceMask & 1 ? secondary.customerName : null,
        phone: invoiceMask & 2 ? secondary.phone : null, document: invoiceMask & 4 ? secondary.document : null,
        documentType: invoiceMask & 4 ? secondary.documentType : null,
      };
      const fixture = setup(customer, { invoice });
      const snapshot = structuredClone(fixture.input);
      assert.deepEqual(await fixture.service.getCustomer(fixture.input), {
        name: customer.name ?? invoice.customerName,
        phone: customer.phone ?? invoice.phone,
        document: customer.document ?? invoice.document,
        documentType: customer.documentType ?? invoice.documentType,
      });
      assert.deepEqual(fixture.input, snapshot);
      assert.equal(fixture.calls.length, sourceMask === 7 ? 0 : 2);
    });
  }
}

test("pedido completo evita buscar entregas, notas ou processar XML", async () => {
  const fixture = setup({ name: "  Nome   do pedido  ", phone: "(11) 99999-9999", document: "123.456.789-00" });
  assert.deepEqual(await fixture.service.getCustomer(fixture.input), primary);
  assert.deepEqual(fixture.calls, []);
});

test("nome ausente aciona fallback mesmo com telefone e documento disponíveis", async () => {
  const fixture = setup({ ...primary, name: null });
  assert.deepEqual(await fixture.service.getCustomer(fixture.input), { ...primary, name: secondary.customerName });
  assert.equal(fixture.calls.length, 2);
});

test("tipo ausente é inferido do documento sem requerer NF-e", async () => {
  const fixture = setup({ name: primary.name, phone: primary.phone, document: "12345678900" });
  assert.deepEqual(await fixture.service.getCustomer(fixture.input), primary);
  assert.equal(fixture.calls.length, 0);
});

test("CNPJ e telefone formatados do pedido são normalizados sem consulta fiscal", async () => {
  const fixture = setup({ name: "Empresa de teste", phone: "(21) 3000-0001", document: "00.000.000/0000-00", documentType: "CNPJ" });
  assert.deepEqual(await fixture.service.getCustomer(fixture.input), {
    name: "Empresa de teste", phone: "552130000001", document: "00000000000000", documentType: "CNPJ",
  });
  assert.equal(fixture.calls.length, 0);
});

test("campos inválidos ou em branco são ausências e podem ser completados", async () => {
  const fixture = setup({ name: "  ", phone: "9999", document: "***.456.789-00", documentType: "CPF" }, {
    invoice: { ...secondary, phone: "+55 (11) 98888-8888", document: "123.456.789-00" },
  });
  assert.deepEqual(await fixture.service.getCustomer(fixture.input), {
    name: secondary.customerName, phone: secondary.phone, document: secondary.document, documentType: "CPF",
  });
});

test("documento e tipo incompatíveis não sobrevivem à normalização", async () => {
  const fixture = setup({ ...primary, documentType: "CNPJ" }, { invoice: { ...secondary, document: "00000000000000", documentType: "CNPJ" } });
  assert.deepEqual(await fixture.service.getCustomer(fixture.input), { ...primary, document: "00000000000000", documentType: "CNPJ" });
});

test("NF-e sem campos válidos nunca substitui valores do pedido por null", async () => {
  const fixture = setup({ ...primary, phone: null }, { invoice: {
    ...secondary, customerName: " ", phone: "123", document: "documento-inválido", documentType: null,
  } });
  assert.deepEqual(await fixture.service.getCustomer(fixture.input), { ...primary, phone: null });
});

test("documento conhecido divergente impede mistura de dados de outro destinatário", async () => {
  const fixture = setup({ ...primary, phone: null }, { invoice: { ...secondary, document: "11111111111" } });
  const errors: MagaluHttpError[] = [];
  assert.deepEqual(await fixture.service.getCustomer({ ...fixture.input, onFallbackError: error => errors.push(error) }), { ...primary, phone: null });
  assert.equal(errors[0]?.code, "invalid_response");
});

test("sem entregas ou sem nota mantém os dados originais normalizados", async () => {
  for (const options of [{ batches: [] }, { invoice: null }]) {
    const fixture = setup({ ...primary, phone: null }, options);
    assert.deepEqual(await fixture.service.getCustomer(fixture.input), { ...primary, phone: null });
  }
});

test("falhas fiscais preservam os oito estados de dados do pedido", async () => {
  for (let mask = 0; mask < 8; mask++) {
    const customer = { name: mask & 1 ? primary.name : null, phone: mask & 2 ? primary.phone : null,
      document: mask & 4 ? primary.document : null, documentType: mask & 4 ? primary.documentType : null };
    const fixture = setup(customer, { invoices: { async getInvoice() { throw new Error("XML-SENSIVEL TOKEN-SENSIVEL"); } } });
    const errors: MagaluHttpError[] = [];
    assert.deepEqual(await fixture.service.getCustomer({ ...fixture.input, onFallbackError: error => errors.push(error) }), customer);
    assert.equal(errors.length, mask === 7 ? 0 : 1);
    assert.ok(!JSON.stringify(errors).includes("SENSIVEL"));
  }
});

test("403, 429, erro de XML e indisponibilidade fiscal não eliminam cliente do pedido", async () => {
  for (const [code, status] of [["forbidden", 403], ["rate_limited", 429], ["invalid_response", 502], ["unavailable", 503]] as const) {
    const fixture = setup({ ...primary, phone: null }, { invoices: { async getInvoice() {
      throw new MagaluHttpError("Falha fiscal segura", status, code, status, "11111111-1111-4111-8111-111111111111");
    } } });
    const errors: MagaluHttpError[] = [];
    assert.deepEqual(await fixture.service.getCustomer({ ...fixture.input, onFallbackError: error => errors.push(error) }), { ...primary, phone: null });
    assert.equal(errors[0]?.code, code);
    assert.equal(errors[0]?.requestId, "11111111-1111-4111-8111-111111111111");
  }
});

test("falha ao buscar entregas também mantém dados do pedido", async () => {
  const fixture = setup({ ...primary, phone: null }, { deliveries: { async *getDeliveries() { throw new Error("FALHA-SENSIVEL"); } } });
  assert.deepEqual(await fixture.service.getCustomer(fixture.input), { ...primary, phone: null });
});

test("diagnóstico que lança erro não elimina resultado", async () => {
  const fixture = setup({ ...primary, phone: null }, { invoices: { async getInvoice() { throw new Error("Falha"); } } });
  assert.deepEqual(await fixture.service.getCustomer({ ...fixture.input, onFallbackError() { throw new Error("Falha do consumidor"); } }),
    { ...primary, phone: null });
});

test("doc conhecido: continua após nota indisponível ou erro e para quando os campos estiverem completos", async () => {
  const thirdDelivery = { ...delivery, externalDeliveryId: "00000000-0000-4000-8000-000000000032" };
  const fixture = setup({ ...primary, phone: null }, { batches: [[delivery], [secondDelivery], [thirdDelivery]], invoices: {
    async getInvoice(input) {
      assert.equal(input.customer?.document, primary.document);
      if (input.delivery.externalDeliveryId === delivery.externalDeliveryId) throw new MagaluHttpError("XML inválido", 502, "invalid_response");
      return secondary;
    },
  } });
  assert.deepEqual(await fixture.service.getCustomer(fixture.input), { ...primary, phone: secondary.phone });
  assert.deepEqual(fixture.calls, ["batch:0", delivery.externalDeliveryId, "batch:1", secondDelivery.externalDeliveryId]);
});

test("doc conhecido: duas entregas do mesmo comprador podem complementar nome e telefone", async () => {
  const fixture = setup({ ...primary, name: null, phone: null }, { batches: [[delivery, secondDelivery]], invoices: {
    async getInvoice(input) {
      return input.delivery.externalDeliveryId === delivery.externalDeliveryId ? { ...secondary, phone: null }
        : { ...secondary, customerName: "Outro nome da mesma pessoa" };
    },
  } });
  assert.deepEqual(await fixture.service.getCustomer(fixture.input), { ...primary, name: secondary.customerName, phone: secondary.phone });
});

test("doc ausente: confere todos os pacotes e complementa dados apenas do mesmo destinatário", async () => {
  const fixture = setup({ ...empty, name: primary.name }, { batches: [[delivery], [secondDelivery]], invoices: {
    async getInvoice(input) {
      assert.equal(input.customer?.document, null);
      return input.delivery.externalDeliveryId === delivery.externalDeliveryId ? { ...secondary, phone: null } : secondary;
    },
  } });
  assert.deepEqual(await fixture.service.getCustomer(fixture.input), { ...primary, phone: secondary.phone });
  assert.equal(fixture.calls.length, 4);
});

test("doc ausente: destinatários diferentes ou não identificados entre pacotes não são combinados", async () => {
  for (const document of ["11111111111", null]) {
    const fixture = setup({ ...primary, document: null, documentType: null }, { batches: [[delivery, secondDelivery]], invoices: {
      async getInvoice(input) { return input.delivery.externalDeliveryId === delivery.externalDeliveryId ? secondary :
        { ...secondary, document, documentType: document ? "CPF" : null }; },
    } });
    assert.deepEqual(await fixture.service.getCustomer(fixture.input), { ...primary, document: null, documentType: null });
  }
});

test("doc ausente: erro na consulta de outro pacote impede seleção incompleta sem perder pedido", async () => {
  const fixture = setup({ ...empty, name: primary.name }, { batches: [[delivery, secondDelivery]], invoices: {
    async getInvoice(input) {
      if (input.delivery.externalDeliveryId === secondDelivery.externalDeliveryId) throw new Error("Falha fiscal");
      return secondary;
    },
  } });
  assert.deepEqual(await fixture.service.getCustomer(fixture.input), { ...empty, name: primary.name });
});

test("doc conhecido: falha posterior não apaga complemento já conferido", async () => {
  const fixture = setup({ ...primary, name: null, phone: null }, { deliveries: { async *getDeliveries() {
    yield [delivery]; throw new Error("Falha da próxima página");
  } }, invoice: { ...secondary, phone: null } });
  assert.deepEqual(await fixture.service.getCustomer(fixture.input), { ...primary, name: secondary.customerName, phone: null });
});

test("entrega de outro pedido ou conta nunca é enviada ao serviço fiscal", async () => {
  const fixture = setup({ ...primary, phone: null }, { batches: [[{ ...delivery, externalOrderId: "OUTRO-PEDIDO" }]] });
  assert.deepEqual(await fixture.service.getCustomer(fixture.input), { ...primary, phone: null });
  assert.deepEqual(fixture.calls, ["batch:0"]);
});

test("conta não autorizada falha mesmo com cliente completo no pedido", async () => {
  for (const invalid of [null, { ...account, userId: otherUserId }, { ...account, isActive: false }, { ...account, platform: "MERCADO_LIVRE" as const }]) {
    const fixture = setup(primary, { account: invalid });
    await assert.rejects(fixture.service.getCustomer(fixture.input), error => error instanceof MagaluHttpError && error.code === "invalid_account");
    assert.equal(fixture.calls.length, 0);
  }
});

test("pedido inválido ou plataforma incorreta falha antes de consultas", async () => {
  const fixture = setup();
  await assert.rejects(fixture.service.getCustomer({ ...fixture.input, order: { ...fixture.input.order, platform: "MERCADO_LIVRE" } }),
    error => error instanceof AppError && error.statusCode === 400);
  assert.equal(fixture.calls.length, 0);
});

test("integração com serviços reais e transporte mockado: order.customer principal + XML compartilhado", async () => {
  const config = getMagaluConfig({ MAGALU_ENV: "sandbox" });
  const calls: string[] = [];
  let now = Date.now();
  const limiter = new MagaluRequestLimiter({ nowFn: () => now, sleepFn: async delay => { now += delay; } });
  const createClient = (owned: MagaluTokenAccount) => new MagaluClient(owned, {
    getConfig: () => config, getOAuthConfig: () => ({ ...oauthTestConfig, environment: "sandbox", audience: config.apiBaseUrl }),
    tokenService: { getAccessToken: async () => "token-ficticio" }, limiter, nowFn: () => now,
    fetchFn: async (url, init) => {
      const target = new URL(String(url)); calls.push(target.pathname);
      assert.equal(new Headers(init?.headers).get("x-channel-id"), config.channelId);
      const isInvoices = target.pathname.endsWith("/invoices");
      const results = Number(target.searchParams.get("_offset")) > 0 ? [] : isInvoices ? [invoiceFixture()] : [{
        id: delivery.externalDeliveryId, code: "PEDIDO-FICTICIO-1", status: "invoiced",
        order: { code: delivery.externalOrderId, channel: { id: config.channelId } },
      }];
      return Response.json({ results, meta: { links: { self: target.search, next: null, previous: null }, page: {
        offset: Number(target.searchParams.get("_offset")), count: results.length,
        limit: Number(target.searchParams.get("_limit")), max_limit: 100,
      } } });
    },
  });
  const deps = { findAccount: async () => account, createClient, getConfig: () => config };
  const service = new MagaluCustomerService(testUserId, { findAccount: deps.findAccount,
    deliveries: new MagaluDeliveryService(testUserId, deps), invoices: new MagaluInvoiceService(testUserId, deps) });
  const extracted = new MagaluCustomerExtractor().extract({ customer: { name: primary.name,
    document_number: invoiceFixtureCpf, customer_type: "cpf", phones: [] } });
  const result = await service.getCustomer({ marketplaceAccountId: accountId, order: order(extracted) });
  assert.deepEqual(result, { name: primary.name, phone: "5511999990000", document: invoiceFixtureCpf, documentType: "CPF" });
  assert.equal(calls.filter(path => path.endsWith("/invoices")).length, 2);
  assert.equal(calls.length, 3);
});
