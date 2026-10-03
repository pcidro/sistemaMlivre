import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import { magaluOrderFixtures, magaluOrderResponseFixture } from "./fixtures/magaluOrders";
import { MagaluOrderMapper } from "./MagaluOrderMapper";
import { magaluOrderResponseSchema } from "./magaluOrder.types";

const mapper = new MagaluOrderMapper();

test("mapeia cliente CPF e conserva o código textual, status do pedido e data de pagamento", () => {
  const result = mapper.map(magaluOrderFixtures.cpf);
  assert.equal(result.externalOrderId, "0000000000000001");
  assert.equal(result.platform, "MAGALU");
  assert.equal(result.status, "approved");
  assert.equal(result.orderDate?.toISOString(), "2026-09-01T10:00:00.000Z");
  assert.deepEqual(result.customer, {
    name: "Cliente CPF de teste", phone: null, document: "00000000000", documentType: "CPF",
  });
});

test("mapeia cliente CNPJ reutilizando a normalização compartilhada", () => {
  assert.deepEqual(mapper.map(magaluOrderFixtures.cnpj).customer, {
    name: "Empresa de teste", phone: null, document: "00000000000000", documentType: "CNPJ",
  });
});

test("monta celular com país +55, DDD e número local; descarta email", () => {
  assert.deepEqual(mapper.map(magaluOrderFixtures.mobile).customer, {
    name: "Cliente com celular", phone: "5511900000001", document: null, documentType: null,
  });
});

test("prioriza mobile válido e desempata pela ordem original", () => {
  const source = structuredClone(magaluOrderFixtures.multiplePhones);
  const snapshot = structuredClone(source);
  assert.equal(mapper.map(source).customer.phone, "5521900000003");
  assert.deepEqual(source, snapshot);
});

test("cliente sem telefone mantém documento e phone null", () => {
  const customer = mapper.map(magaluOrderFixtures.noPhone).customer;
  assert.equal(customer.phone, null);
  assert.equal(customer.documentType, "CPF");
});

test("cliente sem documento mantém document e documentType null", () => {
  const customer = mapper.map(magaluOrderFixtures.noDocument).customer;
  assert.equal(customer.document, null);
  assert.equal(customer.documentType, null);
});

test("campos opcionais ausentes/nulos não inventam cliente, telefone, data ou itens", () => {
  for (const payload of [{ code: "TESTE" }, {
    code: "TESTE", status: null, purchased_at: null, customer: null, deliveries: null,
  }, { code: "TESTE", customer: { name: "  ", phones: null }, deliveries: [{ items: null }] }]) {
    assert.deepEqual(mapper.map(payload), {
      externalOrderId: "TESTE", platform: "MAGALU", status: null, orderDate: null,
      customer: { name: null, phone: null, document: null, documentType: null }, items: [],
    });
  }
});

test("residential e comercial têm mesma prioridade e vencem tipos desconhecidos", () => {
  const phones = [
    { area_code: "11", number: "30000001", type: "outro" },
    { area_code: "21", number: "30000002", type: "residential" },
    { area_code: "31", number: "30000003", type: "comercial" },
  ];
  assert.equal(mapper.map({ code: "TESTE", customer: { phones } }).customer.phone, "552130000002");
  assert.equal(mapper.map({ code: "TESTE", customer: { phones: phones.toReversed() } }).customer.phone, "553130000003");
});

test("não trata commercial como alias de comercial; usa primeiro telefone válido no fallback", () => {
  const phones = [
    { number: "1", type: "mobile" },
    { area_code: "11", number: "30000001", type: "outro" },
    { area_code: "21", number: "30000002", type: "commercial" },
  ];
  assert.equal(mapper.map({ code: "TESTE", customer: { phones } }).customer.phone, "551130000001");
});

test("ignora celular inválido ou estrangeiro e seleciona o próximo telefone válido", () => {
  const phones = [
    { type: "mobile", country_code: "1", area_code: "21", number: "900000001" },
    { type: "mobile", area_code: "11", number: "abc900000001" },
    { type: "mobile", area_code: "xx", number: "900000001" },
    { type: "mobile", number: "900000001" },
    { type: "residential", area_code: "11", number: "30000001" },
  ];
  assert.equal(mapper.map({ code: "TESTE", customer: { phones } }).customer.phone, "551130000001");
});

test("sem país usa normalizePhone; aceita número completo quando DDD está ausente", () => {
  for (const phone of [
    { area_code: "11", number: "900000001" },
    { number: "+55 (11) 90000-0001" },
    { number: "11900000001" },
    { country_code: "0055", area_code: "11", number: "900000001" },
  ]) assert.equal(mapper.map({ code: "TESTE", customer: { phones: [phone] } }).customer.phone, "5511900000001");
});

test("telefone estrangeiro completo ou todos inválidos resultam em null", () => {
  const phones = [{ number: "+1 212 555 0100" }, { number: "0012125550100" }, {}, { number: "123" }];
  assert.equal(mapper.map({ code: "TESTE", customer: { phones } }).customer.phone, null);
});

test("documento incompatível, desconhecido ou inválido não recebe CPF/CNPJ", () => {
  for (const customer of [
    { document_number: "00000000000", customer_type: "cnpj" },
    { document_number: "00000000000000", customer_type: "cpf" },
    { document_number: "00000000000", customer_type: "outro" },
    { document_number: "abc00000000000", customer_type: "cpf" },
    { document_number: "123", customer_type: "cpf" },
    { customer_type: "cnpj" },
  ]) {
    const mapped = mapper.map({ code: "TESTE", customer }).customer;
    assert.equal(mapped.document, null);
    assert.equal(mapped.documentType, null);
  }
});

test("tipo ausente é inferido pelo helper compartilhado e tipo em maiúsculas é aceito", () => {
  for (const customer of [
    { document_number: "000.000.000-00" },
    { document_number: "000.000.000-00", customer_type: " CPF " },
  ]) assert.equal(mapper.map({ code: "TESTE", customer }).customer.documentType, "CPF");
});

test("achata itens de todas as entregas sem somar ou deduplicar linhas", () => {
  const delivery = magaluOrderFixtures.cpf.deliveries?.[0];
  const result = mapper.map({ ...magaluOrderFixtures.cpf, deliveries: [delivery, delivery] });
  assert.deepEqual(result.items, Array.from({ length: 2 }, () => ({
    externalProductId: "00000000-0000-4000-8000-000000000003",
    productName: "Produto de teste", quantity: 2, unitPrice: "19.90",
  })));
});

test("item usa SKU e descrição na ausência de id e nome; preço ausente é null", () => {
  const result = mapper.map({ code: "TESTE", deliveries: [{ items: [
    { info: { sku: "SKU-TESTE", description: " Descrição de teste " }, quantity: 1 },
    { info: { name: " Outro produto " }, quantity: 0, unit_price: { value: 123 } },
  ] }] });
  assert.deepEqual(result.items, [
    { externalProductId: "SKU-TESTE", productName: "Descrição de teste", quantity: 1, unitPrice: null },
    { externalProductId: null, productName: "Outro produto", quantity: 0, unitPrice: null },
  ]);
});

test("preço usa normalizer e mantém precisão decimal inclusive em inteiros grandes", () => {
  for (const [value, normalizer, expected] of [
    [0, 100, "0.00"], [10, 100, "0.10"], [123, 10, "12.3"], [12, 1, "12"],
    [Number.MAX_SAFE_INTEGER, 100, "90071992547409.91"],
  ] as const) {
    const result = mapper.map({ code: "TESTE", deliveries: [{ items: [{
      info: { name: "Teste" }, quantity: 1, unit_price: { currency: "BRL", normalizer, value },
    }] }] });
    assert.equal(result.items[0]?.unitPrice, expected);
  }
});

test("rejeita dados essenciais inválidos com erro seguro sem payload ou dados pessoais", () => {
  const invalid = [
    null, [], {}, { id: "UUID-SEM-CODE" }, { code: " " }, { code: 123 },
    { code: "TESTE", purchased_at: "2026-02-30T10:00:00Z" },
    { code: "TESTE", purchased_at: "2026-09-01" },
    { code: "TESTE", customer: { document_number: 123, name: "DADO-SENSIVEL" } },
    ...[
      { info: { name: "Teste" } },
      { quantity: 1 },
      { info: { name: "Teste" }, quantity: -1 },
      { info: { name: "Teste" }, quantity: 1.5 },
      { info: { name: "Teste" }, quantity: 1, unit_price: { currency: "USD", normalizer: 100, value: 100 } },
      { info: { name: "Teste" }, quantity: 1, unit_price: { currency: "BRL", normalizer: 3, value: 100 } },
      { info: { name: "Teste" }, quantity: 1, unit_price: { value: Number.MAX_SAFE_INTEGER + 1 } },
    ].map(item => ({ code: "TESTE", deliveries: [{ items: [item] }] })),
  ];
  for (const payload of invalid) {
    assert.throws(() => mapper.map(payload), error => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 502);
      assert.equal(error.message.includes("DADO-SENSIVEL"), false);
      return true;
    });
  }
});

test("tipa o envelope oficial meta/results e permite mapear fixtures sem transporte", () => {
  const response = magaluOrderResponseSchema.parse(magaluOrderResponseFixture);
  assert.equal(response.meta.page.count, 6);
  assert.equal(response.results.map(order => mapper.map(order)).length, 6);
});

test("retorno contém somente campos internos; dados de entrega não substituem customer", () => {
  const result = mapper.map({
    code: "TESTE", email: "pedido@example.invalid", token: "NÃO-EXPORTAR",
    deliveries: [{ shipping: { recipient: { name: "Outra pessoa", phones: [{ number: "11900000001" }] } } }],
  });
  assert.deepEqual(result.customer, { name: null, phone: null, document: null, documentType: null });
  assert.deepEqual(Object.keys(result).sort(), ["customer", "externalOrderId", "items", "orderDate", "platform", "status"]);
});
