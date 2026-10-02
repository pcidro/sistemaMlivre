import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import { CustomerQueryService } from "./CustomerQueryService";
import { fixtureId, MemoryCustomerQueryDatabase } from "./testing/MemoryCustomerQueryDatabase";

function setup() {
  const db = new MemoryCustomerQueryDatabase();
  return { db, service: new CustomerQueryService(db.readTransaction) };
}

test("busca CPF/CNPJ com ou sem formatação, preservando escopo do usuário", async () => {
  const { db, service } = setup();
  Object.assign(db.customers[0]!, { document: "12345678900", documentType: "CPF" });
  Object.assign(db.customers[2]!, { document: "12345678000190", documentType: "CNPJ" });
  Object.assign(db.customers[3]!, { document: "00123456789", documentType: "CPF" });
  for (const [search, id, type] of [
    ["12345678900", 1, "CPF"], ["123.456.789-00", 1, "CPF"],
    ["12345678000190", 3, "CNPJ"], ["12.345.678/0001-90", 3, "CNPJ"],
  ] as const) {
    const result = await service.list("user-a", { search });
    assert.deepEqual(result.data.map((row) => row.customerId), [fixtureId(id)]);
    assert.equal(result.data[0]?.documentType, type);
    assert.ok(result.data[0]?.document);
  }
  assert.deepEqual((await service.list("user-a", { search: "001.234.567-89" })).data, []);
  const detail = await service.get("user-a", fixtureId(1));
  assert.equal(detail.document, "12345678900");
  assert.equal(detail.documentType, "CPF");
  const missing = await service.get("user-a", fixtureId(2));
  assert.equal(missing.document, null);
  assert.equal(missing.documentType, null);
});

test("lista somente clientes com pedidos do usuário, uma linha por cliente e sem dados sensíveis", async () => {
  const { db, service } = setup();
  const result = await service.list("user-a", {});
  assert.deepEqual(result.pagination, { page: 1, limit: 50, total: 5, totalPages: 1 });
  assert.equal(new Set(result.data.map((row) => row.customerId)).size, 5);
  assert.ok(!result.data.some((row) => [fixtureId(4), fixtureId(5)].includes(row.customerId)));
  const maria = result.data.find((row) => row.customerId === fixtureId(1));
  assert.ok(maria);
  assert.equal(maria.externalOrderId, "MAG-200");
  assert.equal(maria.marketplaceAccount.id, fixtureId(20));
  assert.equal(maria.platform, "MAGALU");
  assert.deepEqual(Object.keys(maria).sort(), [
    "customerId", "document", "documentType", "externalOrderId", "marketplaceAccount", "name", "normalizedPhone", "orderDate", "phone", "platform",
  ]);
  assert.equal(JSON.stringify(result).includes("token-"), false);
  assert.equal(JSON.stringify(result).includes("SECRET-900"), false);
  assert.equal(JSON.stringify(result).includes("userId"), false);
  assert.equal(db.calls.count, 1);
  assert.equal(db.calls.findMany, 1);
  assert.equal(db.calls.findFirst, 0);
  assert.deepEqual(db.lastCount?.where, db.lastFindMany?.where);
});

test("pagina clientes distintos com ordenação estável e informa totalPages", async () => {
  const { service } = setup();
  const first = await service.list("user-a", { page: "1", limit: "2" });
  const second = await service.list("user-a", { page: "2", limit: "2" });
  assert.deepEqual(first.pagination, { page: 1, limit: 2, total: 5, totalPages: 3 });
  assert.equal(second.data.length, 2);
  assert.equal(new Set([...first.data, ...second.data].map((row) => row.customerId)).size, 4);
  const outside = await service.list("user-a", { page: "10", limit: "2" });
  assert.deepEqual(outside.data, []);
  assert.equal(outside.pagination.total, 5);
});

test("busca por nome sem diferenciar caixa e por telefone formatado ou parcial", async () => {
  const { service } = setup();
  for (const search of ["mArIa", "(11) 99999-0000", "+55 11 99999-0000", "999990000"]) {
    const result = await service.list("user-a", { search });
    assert.deepEqual(result.data.map((row) => row.customerId), [fixtureId(1)]);
  }
});

test("busca por pedido seleciona esse pedido, mesmo se há outra venda mais recente", async () => {
  const { service } = setup();
  const result = await service.list("user-a", { search: "ml-100" });
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0]?.externalOrderId, "ML-100");
  assert.equal(result.data[0]?.platform, "MERCADO_LIVRE");
  assert.equal(result.data[0]?.marketplaceAccount.id, fixtureId(10));
});

test("pedido de outro usuário não pode fazer um cliente compartilhado aparecer na busca", async () => {
  const { service } = setup();
  for (const search of ["SECRET-900", "OUTRO-300"]) {
    const result = await service.list("user-a", { search });
    assert.deepEqual(result.data, []);
    assert.equal(result.pagination.total, 0);
  }
});

test("filtros de plataforma, conta e período se aplicam ao mesmo pedido", async () => {
  const { service } = setup();
  const result = await service.list("user-a", {
    platform: "MERCADO_LIVRE", marketplaceAccountId: fixtureId(10),
    dateFrom: "2026-09-01", dateTo: "2026-09-10", hasPhone: "true", search: "Maria",
  });
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0]?.externalOrderId, "ML-100");
  const nonMatching = await service.list("user-a", { platform: "MERCADO_LIVRE", dateFrom: "2026-09-19" });
  assert.equal(nonMatching.data.length, 0);
});

test("filtrar uma conta alheia ou não existente retorna lista vazia", async () => {
  const { service } = setup();
  for (const marketplaceAccountId of [fixtureId(30), fixtureId(99)]) {
    const result = await service.list("user-a", { marketplaceAccountId });
    assert.deepEqual(result.data, []);
    assert.equal(result.pagination.total, 0);
  }
});

test("hasPhone true/false separa clientes e mantém campos opcionais null", async () => {
  const { service } = setup();
  const withPhone = await service.list("user-a", { hasPhone: "true" });
  const withoutPhone = await service.list("user-a", { hasPhone: "false" });
  assert.equal(withPhone.pagination.total, 2);
  assert.equal(withoutPhone.pagination.total, 3);
  assert.ok(withPhone.data.every((row) => row.normalizedPhone !== null));
  assert.ok(withoutPhone.data.every((row) => row.phone === null && row.normalizedPhone === null));
  assert.ok(withoutPhone.data.some((row) => row.name === null && row.orderDate === null));
});

test("preserva acesso ao histórico de uma conta do usuário desconectada", async () => {
  const { service } = setup();
  const result = await service.list("user-a", { marketplaceAccountId: fixtureId(40) });
  assert.equal(result.data[0]?.externalOrderId, "ML-OLD");
});

test("datas são inclusivas; data sem fuso usa dia UTC inteiro; pedidos sem data não passam pelo filtro", async () => {
  const { db, service } = setup();
  db.orders.find((row) => row.externalOrderId === "ML-101")!.orderDate = new Date("2026-09-15T23:59:59.999Z");
  const result = await service.list("user-a", { dateFrom: "2026-09-15", dateTo: "2026-09-15" });
  assert.deepEqual(result.data.map((row) => row.customerId), [fixtureId(2)]);
  const exact = await service.list("user-a", { dateFrom: "2026-09-15T20:59:59.999-03:00", dateTo: "2026-09-15T20:59:59.999-03:00" });
  assert.equal(exact.data.length, 1);
});

test("busca vazia não filtra; curingas SQL são tratados como caracteres literais", async () => {
  const { db, service } = setup();
  assert.equal((await service.list("user-a", { search: "  " })).pagination.total, 5);
  assert.equal((await service.list("user-a", { search: "%" })).pagination.total, 0);
  db.customers[0]!.name = "Cliente_100% Fictício";
  assert.equal((await service.list("user-a", { search: "_100%" })).pagination.total, 1);
});

test("detalhes usam o vínculo do usuário e mostram somente um pedido autorizado", async () => {
  const { db, service } = setup();
  const result = await service.get("user-a", fixtureId(1));
  assert.equal(result.customerId, fixtureId(1));
  assert.equal(result.externalOrderId, "MAG-200");
  assert.equal(JSON.stringify(result).includes("token-"), false);
  assert.equal(db.calls.findFirst, 1);
  assert.equal(db.calls.findMany + db.calls.count, 0);
});

test("detalhes alheios, inexistentes ou sem pedido autorizado retornam o mesmo 404", async () => {
  const { service } = setup();
  for (const id of [fixtureId(4), fixtureId(5), fixtureId(99)]) {
    await assert.rejects(service.get("user-a", id),
      (error: unknown) => error instanceof AppError && error.statusCode === 404 && error.message === "Cliente não encontrado");
  }
});

test("falhas no banco são sanitizadas em ambas as consultas", async () => {
  const { db, service } = setup();
  db.fail = true;
  for (const operation of [() => service.list("user-a", {}), () => service.get("user-a", fixtureId(1))]) {
    await assert.rejects(operation(),
      (error: unknown) => error instanceof AppError && error.statusCode === 503 && !error.message.includes("SQL"));
  }
});

test("rejeita usuário ausente antes de consultar o banco", async () => {
  const { db, service } = setup();
  await assert.rejects(service.list("", {}));
  await assert.rejects(service.get("", fixtureId(1)));
  assert.equal(db.calls.transactions, 0);
});
