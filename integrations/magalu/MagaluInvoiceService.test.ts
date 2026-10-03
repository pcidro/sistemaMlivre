import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import { NFeParserService } from "../../services/invoices/NFeParserService";
import type { MarketplaceCustomer, MarketplaceDelivery } from "../types";
import { fixtureProductionChannelId } from "./fixtures/magaluDeliveries";
import { invoiceFixture, invoiceFixtureKey, secondInvoiceFixtureKey, invoiceFixtureCpf, invoiceFixtureCnpj } from "./fixtures/magaluInvoices";
import { MagaluClient } from "./MagaluClient";
import { getMagaluConfig } from "./magaluConfig";
import { MagaluHttpError } from "./magaluHttpError";
import { MagaluInvoiceService } from "./MagaluInvoiceService";
import { oauthTestConfig, testUserId, otherUserId, tenantId } from "./magaluOAuthTestSupport";
import { MagaluRequestLimiter } from "./MagaluRequestLimiter";
import type { MagaluTokenAccount } from "./magaluTokenStorage";

const accountId = "00000000-0000-4000-8000-000000000010";
const deliveryId = "00000000-0000-4000-8000-000000000030";
const requestId = "11111111-1111-4111-8111-111111111111";
const customer: MarketplaceCustomer = { name: "Maria Fictícia", phone: null, document: invoiceFixtureCpf, documentType: "CPF" };
const account: MagaluTokenAccount = {
  id: accountId, platform: "MAGALU", userId: testUserId, isActive: true, externalAccountId: tenantId,
  accessTokenEncrypted: "token-provider-mockado", refreshTokenEncrypted: null, tokenExpiresAt: new Date(Date.now() + 7200_000),
};

function page(url: URL, results: unknown[], maxLimit = 100) {
  return Response.json({ results, meta: {
    links: { self: url.search, next: null, previous: null },
    page: { count: results.length, offset: Number(url.searchParams.get("_offset")),
      limit: Number(url.searchParams.get("_limit")), max_limit: maxLimit },
  } }, { headers: { "X-Request-ID": requestId } });
}

function setup(api: (url: URL, call: number) => Response, options: {
  production?: boolean;
  account?: MagaluTokenAccount | null;
  pageSize?: number;
} = {}) {
  const config = getMagaluConfig({ MAGALU_ENV: options.production ? "production" : "sandbox" });
  const delivery: MarketplaceDelivery = {
    marketplaceAccountId: accountId, externalDeliveryId: deliveryId, externalDeliveryCode: "PEDIDO-TESTE-1",
    externalOrderId: "PEDIDO-TESTE", platform: "MAGALU", status: "invoiced",
    channelId: options.production ? fixtureProductionChannelId : config.channelId,
  };
  const calls: { url: URL; init: RequestInit | undefined }[] = [];
  const parser = new NFeParserService();
  let parserCalls = 0;
  let now = Date.now();
  const delays: number[] = [];
  const limiter = new MagaluRequestLimiter({ nowFn: () => now, sleepFn: async delay => { delays.push(delay); now += delay; } });
  const service = new MagaluInvoiceService(testUserId, {
    pageSize: options.pageSize ?? 5, getConfig: () => config,
    findAccount: async id => {
      assert.equal(id, accountId);
      return options.account === undefined ? account : options.account;
    },
    parser: { parse: xml => { parserCalls++; return parser.parse(xml); } },
    createClient: ownedAccount => new MagaluClient(ownedAccount, {
      getConfig: () => config,
      getOAuthConfig: () => ({ ...oauthTestConfig, environment: config.environment, audience: config.apiBaseUrl }),
      nowFn: () => now, limiter, tokenService: { getAccessToken: async () => "token-ficticio" },
      fetchFn: async (url, init) => {
        const parsed = new URL(String(url));
        calls.push({ url: parsed, init });
        assert.equal(parsed.pathname, `/seller/v1/deliveries/${deliveryId}/invoices`);
        return api(parsed, calls.length);
      },
    }),
  });
  return { service, delivery, calls, delays, parserCalls: () => parserCalls };
}

test("NF-e existente reutiliza o parser compartilhado e retorna dados normalizados sem XML", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? [invoiceFixture()] : []));
  assert.deepEqual(await fixture.service.getInvoice({ delivery: fixture.delivery, customer }), {
    invoiceKey: invoiceFixtureKey, invoiceNumber: "000000123", customerName: "Maria Fictícia & Família",
    phone: "5511999990000", document: invoiceFixtureCpf, documentType: "CPF",
    issuedAt: "2025-03-14T18:12:20.312653", status: "approved",
  });
  assert.equal(fixture.parserCalls(), 1);
  assert.equal(fixture.calls.length, 2);
  const request = fixture.calls[0]!;
  assert.equal(request.url.origin, "https://api-sandbox.magalu.com");
  assert.equal(request.url.searchParams.get("_sort"), "created_at:asc");
  assert.equal(request.url.searchParams.get("_limit"), "5");
  assert.equal(new Headers(request.init?.headers).get("authorization"), "Bearer token-ficticio");
  assert.equal(new Headers(request.init?.headers).get("x-channel-id"), fixture.delivery.channelId);
});

test("sem NF-e retorna null e não chama parser", async () => {
  const fixture = setup(url => page(url, []));
  assert.equal(await fixture.service.getInvoice({ delivery: fixture.delivery }), null);
  assert.equal(fixture.parserCalls(), 0);
});

test("404 ou 204 inicial no endpoint de notas representa ausência de NF-e", async () => {
  for (const status of [404, 204]) {
    const fixture = setup(() => new Response(null, { status }));
    assert.equal(await fixture.service.getInvoice({ delivery: fixture.delivery }), null);
    assert.equal(fixture.calls.length, 1);
  }
});

test("NF-e com CNPJ extrai documento e tipo pelo parser compartilhado", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? [invoiceFixture({ cnpj: true })] : []));
  const invoice = await fixture.service.getInvoice({ delivery: fixture.delivery,
    customer: { ...customer, document: "00.000.000/0000-00", documentType: "CNPJ" } });
  assert.equal(invoice?.document, invoiceFixtureCnpj);
  assert.equal(invoice?.documentType, "CNPJ");
});

test("NF-e sem telefone retorna phone null sem obter telefone do emitente", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? [invoiceFixture({ phone: false })] : []));
  assert.equal((await fixture.service.getInvoice({ delivery: fixture.delivery, customer }))?.phone, null);
});

test("XML inválido gera erro seguro com X-Request-ID, sem conteúdo ou dados pessoais", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? [{ ...invoiceFixture(), xml: "<DADO-SENSIVEL>" }] : []));
  await assert.rejects(fixture.service.getInvoice({ delivery: fixture.delivery, customer }), error => {
    assert.ok(error instanceof MagaluHttpError);
    assert.equal(error.code, "invalid_response");
    assert.equal(error.requestId, requestId);
    assert.ok(!JSON.stringify(error).includes("DADO-SENSIVEL"));
    return true;
  });
});

test("chave da resposta incompatível com XML não pode identificar cliente", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? [{ ...invoiceFixture(), key: secondInvoiceFixtureKey }] : []));
  await assert.rejects(fixture.service.getInvoice({ delivery: fixture.delivery }), error =>
    error instanceof MagaluHttpError && error.code === "invalid_response");
});

test("várias páginas escolhem documento do cliente e nunca a primeira nota de outro destinatário", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? [invoiceFixture({ document: "11111111111" })]
    : call === 2 ? [invoiceFixture({ key: secondInvoiceFixtureKey })] : []), { pageSize: 1 });
  assert.equal((await fixture.service.getInvoice({ delivery: fixture.delivery, customer }))?.invoiceKey, secondInvoiceFixtureKey);
  assert.deepEqual(fixture.calls.map(call => call.url.searchParams.get("_offset")), ["0", "1", "2"]);
  assert.equal(fixture.parserCalls(), 2);
});

test("várias notas do mesmo destinatário preferem telefone válido em qualquer ordem", async () => {
  for (const reverse of [false, true]) {
    const invoices = [invoiceFixture({ phone: false }), invoiceFixture({ key: secondInvoiceFixtureKey })];
    const fixture = setup((url, call) => page(url, call === 1 ? reverse ? invoices.reverse() : invoices : []));
    assert.equal((await fixture.service.getInvoice({ delivery: fixture.delivery }))?.invoiceKey, secondInvoiceFixtureKey);
  }
});

test("empate entre notas do mesmo destinatário usa chave como regra determinística", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? [invoiceFixture({ key: secondInvoiceFixtureKey }), invoiceFixture()] : []));
  assert.equal((await fixture.service.getInvoice({ delivery: fixture.delivery, customer }))?.invoiceKey, invoiceFixtureKey);
});

test("sem documento do pedido, múltiplos destinatários são ambíguos e retornam null", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? [invoiceFixture(),
    invoiceFixture({ key: secondInvoiceFixtureKey, cnpj: true })] : []));
  assert.equal(await fixture.service.getInvoice({ delivery: fixture.delivery }), null);
});

test("documento do pedido sem correspondência nunca recebe destinatário de outra nota", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? [invoiceFixture()] : []));
  assert.equal(await fixture.service.getInvoice({ delivery: fixture.delivery, customer: { ...customer, document: "11111111111" } }), null);
});

test("nota única sem documento preserva null; múltiplas notas sem documento não são combinadas", async () => {
  for (const multiple of [false, true]) {
    const invoices = [invoiceFixture({ document: null })];
    if (multiple) invoices.push(invoiceFixture({ key: secondInvoiceFixtureKey, document: null }));
    const fixture = setup((url, call) => page(url, call === 1 ? invoices : []));
    const invoice = await fixture.service.getInvoice({ delivery: fixture.delivery });
    if (multiple) assert.equal(invoice, null);
    else { assert.ok(invoice); assert.equal(invoice.document, null); assert.equal(invoice.documentType, null); }
  }
});

test("status validating, invalid ou desconhecido não é tratado como NF-e aprovada", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? ["validating", "invalid", "desconhecido"].map(status =>
    ({ ...invoiceFixture({ status }), xml: "XML NÃO DEVE SER PROCESSADO" })) : []));
  assert.equal(await fixture.service.getInvoice({ delivery: fixture.delivery, customer }), null);
  assert.equal(fixture.parserCalls(), 0);
});

test("XML ausente representa nota indisponível e não causa falha de parsing", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? [{ ...invoiceFixture(), xml: null }] : []));
  assert.equal(await fixture.service.getInvoice({ delivery: fixture.delivery, customer }), null);
});

test("sem documento do pedido, outra nota aprovada sem XML impede seleção segura", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? [invoiceFixture(),
    { ...invoiceFixture({ key: secondInvoiceFixtureKey }), xml: null }] : []));
  assert.equal(await fixture.service.getInvoice({ delivery: fixture.delivery }), null);
});

test("nota inválida é reportada e não impede nota válida conferida com documento do pedido", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? [
    { ...invoiceFixture(), xml: "<inválido>" }, invoiceFixture({ key: secondInvoiceFixtureKey }),
  ] : []));
  const errors: MagaluHttpError[] = [];
  const invoice = await fixture.service.getInvoice({ delivery: fixture.delivery, customer, onInvoiceError: error => errors.push(error) });
  assert.equal(invoice?.invoiceKey, secondInvoiceFixtureKey);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.requestId, requestId);
});

test("sem documento do pedido, erro em outra nota não pode ser ocultado por uma candidata", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? [invoiceFixture(),
    { ...invoiceFixture({ key: secondInvoiceFixtureKey }), xml: "<inválido>" }] : []));
  await assert.rejects(fixture.service.getInvoice({ delivery: fixture.delivery }), MagaluHttpError);
});

test("produção utiliza canal da entrega e baseURL centralizada", async () => {
  const fixture = setup(url => page(url, []), { production: true });
  await fixture.service.getInvoice({ delivery: fixture.delivery });
  assert.equal(fixture.calls[0]?.url.origin, "https://api.magalu.com");
  assert.equal(new Headers(fixture.calls[0]?.init?.headers).get("x-channel-id"), fixtureProductionChannelId);
});

test("sandbox rejeita entrega com canal de produção antes de fazer requisição", async () => {
  const fixture = setup(url => page(url, []));
  await assert.rejects(fixture.service.getInvoice({ delivery: { ...fixture.delivery, channelId: fixtureProductionChannelId } }),
    error => error instanceof AppError && error.statusCode === 400);
  assert.equal(fixture.calls.length, 0);
});

test("conta ausente, de outro usuário, plataforma diferente ou inativa não equivale a ausência de notas", async () => {
  for (const invalid of [null, { ...account, userId: otherUserId }, { ...account, platform: "MERCADO_LIVRE" as const },
    { ...account, isActive: false }]) {
    const fixture = setup(url => page(url, []), { account: invalid });
    await assert.rejects(fixture.service.getInvoice({ delivery: fixture.delivery }), error =>
      error instanceof MagaluHttpError && error.code === "invalid_account");
    assert.equal(fixture.calls.length, 0);
  }
});

test("403 preserva erro de permissão sem retornar null", async () => {
  const fixture = setup(() => Response.json({ segredo: "NÃO-EXIBIR" }, { status: 403 }));
  await assert.rejects(fixture.service.getInvoice({ delivery: fixture.delivery }), error =>
    error instanceof MagaluHttpError && error.code === "forbidden" && !JSON.stringify(error).includes("NÃO-EXIBIR"));
});

test("429 respeita Retry-After pelo client compartilhado e permite retomada", async () => {
  const fixture = setup((url, call) => call === 1 ? new Response(null, { status: 429, headers: { "Retry-After": "2" } }) : page(url, []));
  assert.equal(await fixture.service.getInvoice({ delivery: fixture.delivery }), null);
  assert.equal(fixture.calls.length, 2);
  assert.ok(fixture.delays.reduce((sum, delay) => sum + delay, 0) >= 2000);
});

test("erro HTTP intermediário não retorna seleção incompleta", async () => {
  const fixture = setup((url, call) => call === 1 ? page(url, [invoiceFixture()]) : new Response(null, { status: 503 }));
  await assert.rejects(fixture.service.getInvoice({ delivery: fixture.delivery, customer }), error =>
    error instanceof MagaluHttpError && error.code === "unavailable");
  assert.equal(fixture.calls.length, 4);
});

test("404 depois de uma página não oculta coleção incompleta", async () => {
  const fixture = setup((url, call) => call === 1 ? page(url, [invoiceFixture()]) : new Response(null, { status: 404 }));
  await assert.rejects(fixture.service.getInvoice({ delivery: fixture.delivery, customer }), error =>
    error instanceof MagaluHttpError && error.code === "not_found");
});

test("página repetida não permite laço infinito", async () => {
  const fixture = setup(url => page(url, [invoiceFixture()]));
  await assert.rejects(fixture.service.getInvoice({ delivery: fixture.delivery, customer }), error =>
    error instanceof MagaluHttpError && error.code === "invalid_response");
  assert.equal(fixture.calls.length, 2);
});

test("payload inesperado ou metadados inconsistentes geram erro seguro", async () => {
  for (const body of [{ results: [] }, { results: [], meta: { links: { self: "" },
    page: { count: 1, offset: 0, limit: 5, max_limit: 100 } } }]) {
    const fixture = setup(() => Response.json(body));
    await assert.rejects(fixture.service.getInvoice({ delivery: fixture.delivery }), error =>
      error instanceof MagaluHttpError && error.code === "invalid_response");
  }
});

test("paginação adapta limite anunciado e continua após página curta", async () => {
  const fixture = setup((url, call) => page(url, call === 1 ? [invoiceFixture()] : call === 2 ?
    [invoiceFixture({ key: secondInvoiceFixtureKey })] : [], 1));
  await fixture.service.getInvoice({ delivery: fixture.delivery, customer });
  assert.deepEqual(fixture.calls.map(call => call.url.searchParams.get("_limit")), ["5", "1", "1"]);
});
