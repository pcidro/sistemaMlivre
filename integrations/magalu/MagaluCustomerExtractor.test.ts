import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import { magaluOrderFixtures } from "./fixtures/magaluOrders";
import { MagaluCustomerExtractor } from "./MagaluCustomerExtractor";
import { MagaluOrderMapper } from "./MagaluOrderMapper";

const extractor = new MagaluCustomerExtractor();
const emptyCustomer = { name: null, phone: null, document: null, documentType: null };

test("CPF + celular são extraídos diretamente de order.customer", () => {
  const result = extractor.extract({ customer: {
    ...magaluOrderFixtures.cpf.customer,
    phones: magaluOrderFixtures.mobile.customer?.phones,
  } });
  assert.deepEqual(result, {
    name: "Cliente CPF de teste", phone: "5511900000001", document: "00000000000", documentType: "CPF",
  });
});

test("CNPJ + telefone comercial usam componentes e normalizadores compartilhados", () => {
  assert.deepEqual(extractor.extract({ customer: {
    ...magaluOrderFixtures.cnpj.customer,
    phones: [{ country_code: "55", area_code: "21", number: "3000-0001", type: "comercial" }],
  } }), {
    name: "Empresa de teste", phone: "552130000001", document: "00000000000000", documentType: "CNPJ",
  });
});

test("vários telefones priorizam primeiro mobile válido sem alterar o pedido", () => {
  const order = structuredClone(magaluOrderFixtures.multiplePhones);
  const snapshot = structuredClone(order);
  assert.equal(extractor.extract(order).phone, "5521900000003");
  assert.deepEqual(order, snapshot);
});

test("sem telefone retorna phone null e preserva demais informações", () => {
  assert.deepEqual(extractor.extract(magaluOrderFixtures.noPhone), {
    name: "Cliente sem telefone", phone: null, document: "00000000000", documentType: "CPF",
  });
});

test("sem documento retorna document/documentType null sem descartar o celular", () => {
  assert.deepEqual(extractor.extract({ customer: {
    ...magaluOrderFixtures.noDocument.customer,
    phones: magaluOrderFixtures.mobile.customer?.phones,
  } }), { name: "Cliente sem documento", phone: "5511900000001", document: null, documentType: null });
});

test("campos parcialmente ausentes ou nulos não inventam valores", () => {
  for (const order of [{}, { customer: undefined }, { customer: null }, { customer: {} },
    { customer: { name: " ", phones: null, document_number: null, customer_type: null } }]) {
    assert.deepEqual(extractor.extract(order), emptyCustomer);
  }
  assert.deepEqual(extractor.extract({ customer: { name: "  Nome de teste  ", customer_type: "cpf" } }),
    { ...emptyCustomer, name: "Nome de teste" });
  assert.deepEqual(extractor.extract({ customer: { document_number: "00000000000" } }),
    { ...emptyCustomer, document: "00000000000", documentType: "CPF" });
  assert.equal(extractor.extract({ customer: { phones: [{ country_code: "55", area_code: "11" }] } }).phone, null);
});

test("não duplica DDI nem DDD já presentes no campo number", () => {
  for (const number of ["5511900000001", "+55 (11) 90000-0001", "0055 11 90000-0001", "11900000001"]) {
    for (const country_code of ["55", "+55", "0055", undefined]) {
      for (const area_code of ["11", undefined]) {
        const phone = { number, country_code, area_code, type: "mobile" };
        assert.equal(extractor.extract({ customer: { phones: [phone] } }).phone, "5511900000001");
      }
    }
  }
});

test("DDD 55 e número local começando em 55 não são confundidos com DDI", () => {
  for (const phone of [
    { country_code: "55", area_code: "55", number: "900000001" },
    { country_code: "55", area_code: "55", number: "55900000001" },
    { country_code: "55", area_code: "55", number: "5555900000001" },
  ]) assert.equal(extractor.extract({ customer: { phones: [phone] } }).phone, "5555900000001");
  assert.equal(extractor.extract({ customer: { phones: [{ country_code: "55", area_code: "11", number: "55900001" }] } }).phone,
    "551155900001");
});

test("telefones incompletos, estrangeiros ou contraditórios não viram números presumidos", () => {
  for (const phone of [
    { number: "900000001" },
    { number: "+55 900000001" },
    { number: "0055 900000001" },
    { number: "+1 212 555 0100", country_code: "55" },
    { number: "900000001", country_code: "1", area_code: "11" },
    { number: "5511900000001", area_code: "21" },
    { number: "5511900000001", area_code: "xx" },
    { number: "abc900000001", area_code: "11" },
  ]) assert.equal(extractor.extract({ customer: { phones: [phone] } }).phone, null);
});

test("mobile inválido cede a comercial/residential; outros tipos seguem ordem original", () => {
  const phones = [
    { number: "1", type: "mobile" },
    { number: "1130000001", type: "outro" },
    { number: "2130000002", type: "residential" },
    { number: "3130000003", type: "comercial" },
  ];
  assert.equal(extractor.extract({ customer: { phones } }).phone, "552130000002");
  assert.equal(extractor.extract({ customer: { phones: phones.toReversed() } }).phone, "553130000003");
  assert.equal(extractor.extract({ customer: { phones: phones.slice(0, 2) } }).phone, "551130000001");
});

test("documento inválido, declaração desconhecida ou CPF/CNPJ incompatível viram null", () => {
  for (const customer of [
    { document_number: "00000000000", customer_type: "cnpj" },
    { document_number: "00000000000000", customer_type: "cpf" },
    { document_number: "00000000000", customer_type: "outro" },
    { document_number: "***00000000", customer_type: "cpf" },
    { document_number: "123", customer_type: "cpf" },
  ]) assert.deepEqual(extractor.extract({ customer }), emptyCustomer);
  assert.equal(extractor.extract({ customer: { document_number: "00000000000000", customer_type: " CNPJ " } }).documentType, "CNPJ");
});

test("cliente independe de campos de pedido, destinatário da entrega e NF-e", () => {
  const order = {
    customer: { name: "Comprador de teste", email: "teste@example.invalid" },
    purchased_at: "fora-do-escopo-da-extração",
    deliveries: [{ shipping: { recipient: { name: "Outro destinatário", document_number: "00000000000" } } }],
    get invoices(): never { throw new Error("NF-e não deve ser acessada"); },
  };
  assert.deepEqual(extractor.extract(order), { ...emptyCustomer, name: "Comprador de teste" });
});

test("mapper de pedidos reutiliza o extractor inclusive para número com DDI já preenchido", () => {
  const order = {
    ...magaluOrderFixtures.cpf,
    customer: {
      ...magaluOrderFixtures.cpf.customer,
      phones: [{ country_code: "55", area_code: "11", number: "+5511900000001", type: "mobile" }],
    },
  };
  const result = new MagaluOrderMapper().map(order).customer;
  assert.deepEqual(result, extractor.extract(order));
  assert.equal(result.phone, "5511900000001");
});

test("payload malformado retorna erro seguro sem nome, documento ou telefone", () => {
  for (const order of [null, [], { customer: "DADO-SENSIVEL" },
    { customer: { name: "DADO-SENSIVEL", document_number: 123 } }, { customer: { phones: "DADO-SENSIVEL" } }]) {
    assert.throws(() => extractor.extract(order), error => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 502);
      assert.equal(error.message.includes("DADO-SENSIVEL"), false);
      return true;
    });
  }
});
