import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import { ImportedOrderPersistenceService } from "./ImportedOrderPersistenceService";
import type { PersistImportedOrderInput } from "./ImportedOrderPersistenceService";
import { MemoryPersistenceDatabase } from "./testing/MemoryPersistenceDatabase";

const invoiceKey = "35261000000000000100550010000001231000001234";

function input(orderId = "1001"): PersistImportedOrderInput {
  return {
    marketplaceAccountId: "account-a",
    userId: "user-a",
    order: {
      externalOrderId: orderId,
      platform: "MERCADO_LIVRE",
      orderDate: new Date("2026-10-01T12:00:00Z"),
      status: "paid",
      customer: { name: "Maria Fictícia", phone: "5511999990000" },
      items: [
        { externalProductId: "MLB1", productName: "Produto A", quantity: 2, unitPrice: "19.90" },
        { externalProductId: "MLB2", productName: "Produto B", quantity: 1, unitPrice: "10.50" },
      ],
    },
    invoice: { invoiceKey, invoiceNumber: "123", customerName: "Maria Fictícia", phone: "11999990000", document: null, documentType: null },
  };
}

function setup() {
  const db = new MemoryPersistenceDatabase();
  const service = new ImportedOrderPersistenceService({ runTransaction: db.runTransaction, sleepFn: async () => {} });
  return { db, service };
}

function status(code: number) {
  return (error: unknown) => error instanceof AppError && error.statusCode === code;
}

for (const [document, expected, type] of [
  ["123.456.789-00", "12345678900", "CPF"],
  ["12.345.678/0001-90", "12345678000190", "CNPJ"],
] as const) {
  test(`cria e reimporta cliente com ${type}, sem duplicar registros`, async () => {
    const { db, service } = setup();
    const data = input();
    data.order.customer.document = document;
    const first = await service.execute(data);
    const before = structuredClone(db.state.customers);
    const second = await service.execute(data);
    assert.equal(first.customerId, second.customerId);
    assert.equal(db.state.customers[0]?.document, expected);
    assert.equal(db.state.customers[0]?.documentType, type);
    assert.deepEqual(db.state.customers, before);
    assert.equal(db.state.orders.length, 1);
    assert.equal(db.state.invoices.length, 1);
    assert.equal(db.state.items.length, 2);
  });
}

test("reimportação enriquece documento ausente e não o apaga com null ou inválido", async () => {
  const { db, service } = setup();
  const data = input();
  const first = await service.execute(data);
  assert.equal(db.state.customers[0]?.document, null);
  data.order.customer.document = "12345678900";
  await service.execute(data);
  for (const document of [null, "123", "***.456.789-00"]) {
    data.order.customer.document = document;
    await service.execute(data);
    assert.equal(db.state.customers[0]?.document, "12345678900");
    assert.equal(db.state.customers[0]?.documentType, "CPF");
  }
  assert.equal(db.state.customers.length, 1);
  assert.equal(db.state.customers[0]?.id, first.customerId);
});

test("mesmo documento não une clientes sem telefone compatível", async () => {
  const { db, service } = setup();
  for (const id of ["1", "2"]) {
    const data = input(id);
    data.invoice = null;
    data.order.customer = { name: "Maria", phone: null, document: "12345678900" };
    await service.execute(data);
  }
  assert.equal(db.state.customers.length, 2);
});

test("documentos conflitantes impedem união por nome e telefone iguais", async () => {
  const { db, service } = setup();
  for (const [id, document] of [["1", "12345678900"], ["2", "00123456789"]] as const) {
    const data = input(id);
    data.invoice = null;
    data.order.customer.document = document;
    await service.execute(data);
  }
  assert.equal(db.state.customers.length, 2);
});

test("reutiliza cliente compatível sem documento e enriquece com CPF", async () => {
  const { db, service } = setup();
  const first = input("1");
  first.invoice = null;
  const initial = await service.execute(first);
  const next = input("2");
  next.invoice = null;
  next.order.customer.document = "12345678900";
  const result = await service.execute(next);
  assert.equal(result.customerId, initial.customerId);
  assert.equal(db.state.customers.length, 1);
  assert.equal(db.state.customers[0]?.document, "12345678900");
});

test("correção de documento de um pedido não altera cliente compartilhado de outras vendas", async () => {
  const { db, service } = setup();
  for (const id of ["1", "2"]) {
    const data = input(id);
    data.invoice = null;
    data.order.customer.document = "12345678900";
    await service.execute(data);
  }
  const originalId = db.state.customers[0]?.id;
  const changed = input("1");
  changed.invoice = null;
  changed.order.customer.document = "00123456789";
  await service.execute(changed);
  assert.equal(db.state.customers.length, 2);
  assert.equal(db.state.customers.find((row) => row.id === originalId)?.document, "12345678900");
  assert.equal(db.state.orders.find((row) => row.externalOrderId === "2")?.customerId, originalId);
});

test("primeira importação grava cliente, pedido, NF-e e vários produtos relacionados", async () => {
  const { db, service } = setup();
  const result = await service.execute(input());
  assert.equal(result.created, true);
  assert.equal(result.itemsCount, 2);
  assert.equal(db.state.customers.length, 1);
  assert.equal(db.state.orders.length, 1);
  assert.equal(db.state.invoices.length, 1);
  assert.equal(db.state.items.length, 2);
  assert.equal(db.state.orders[0]?.marketplaceAccountId, "account-a");
  assert.equal(db.state.orders[0]?.customerId, result.customerId);
  assert.equal(db.state.invoices[0]?.orderId, result.orderId);
  assert.ok(db.state.items.every((item) => item.orderId === result.orderId));
  assert.equal(db.state.customers[0]?.normalizedPhone, "5511999990000");
  assert.equal(db.state.invoices[0]?.phone, "5511999990000");
  assert.deepEqual(db.state.items.map((item) => [item.productName, item.quantity, item.unitPrice?.toFixed(2)]), [
    ["Produto A", 2, "19.90"], ["Produto B", 1, "10.50"],
  ]);
});

test("reimportar o mesmo pedido não duplica registros nem altera estado inalterado", async () => {
  const { db, service } = setup();
  const first = await service.execute(input());
  const before = { ...db.state };
  const second = await service.execute(input());
  assert.deepEqual(second, { ...first, created: false });
  assert.deepEqual(db.state, before);
});

test("reimportação atualiza campos alterados e substitui produtos sem acumular cópias", async () => {
  const { db, service } = setup();
  const first = await service.execute(input());
  const changed = input();
  changed.order.status = "delivered";
  changed.order.orderDate = new Date("2026-10-01T13:00:00Z");
  changed.order.customer.name = "Maria Fictícia Corrigida";
  changed.order.items = [
    { externalProductId: "MLB1", productName: "Produto A novo", quantity: 3, unitPrice: "20.00" },
    { externalProductId: "MLB3", productName: "Produto C", quantity: 4, unitPrice: "5.10" },
  ];
  assert.ok(changed.invoice);
  changed.invoice.invoiceNumber = "124";
  await service.execute(changed);
  await service.execute(changed);
  assert.equal(db.state.orders.length, 1);
  assert.equal(db.state.customers.length, 1);
  assert.equal(db.state.invoices.length, 1);
  assert.equal(db.state.orders[0]?.id, first.orderId);
  assert.equal(db.state.orders[0]?.status, "delivered");
  assert.equal(db.state.orders[0]?.orderDate?.toISOString(), "2026-10-01T13:00:00.000Z");
  assert.equal(db.state.customers[0]?.name, "Maria Fictícia Corrigida");
  assert.equal(db.state.invoices[0]?.invoiceNumber, "124");
  assert.deepEqual(db.state.items.map((item) => item.externalProductId), ["MLB1", "MLB3"]);
  assert.deepEqual(db.state.items.map((item) => item.quantity), [3, 4]);
});

test("telefone inexistente permite importar e reimportar sem duplicar o cliente do pedido", async () => {
  const { db, service } = setup();
  const data = input();
  data.order.customer.phone = null;
  assert.ok(data.invoice);
  data.invoice.phone = null;
  const first = await service.execute(data);
  const second = await service.execute(data);
  assert.equal(first.customerId, second.customerId);
  assert.equal(db.state.customers.length, 1);
  assert.equal(db.state.customers[0]?.phone, null);
  assert.equal(db.state.customers[0]?.normalizedPhone, null);
});

test("sem NF-e importa todos os outros registros e mantém idempotência", async () => {
  const { db, service } = setup();
  const data = input();
  data.invoice = null;
  assert.equal((await service.execute(data)).invoiceId, null);
  delete data.invoice;
  await service.execute(data);
  assert.equal(db.state.orders.length, 1);
  assert.equal(db.state.customers.length, 1);
  assert.equal(db.state.invoices.length, 0);
  assert.equal(db.state.items.length, 2);
});

test("NF-e que aparece depois é criada uma única vez no pedido existente", async () => {
  const { db, service } = setup();
  const initial = input();
  initial.invoice = null;
  const first = await service.execute(initial);
  const next = await service.execute(input());
  await service.execute(input());
  assert.equal(next.orderId, first.orderId);
  assert.equal(db.state.invoices.length, 1);
});

test("reimportação sem nome, telefone, status, data ou NF-e preserva valores já conhecidos", async () => {
  const { db, service } = setup();
  await service.execute(input());
  const next = input();
  next.order.customer = { name: null, phone: null };
  next.order.status = null;
  next.order.orderDate = null;
  next.invoice = null;
  await service.execute(next);
  assert.equal(db.state.customers[0]?.name, "Maria Fictícia");
  assert.equal(db.state.customers[0]?.normalizedPhone, "5511999990000");
  assert.equal(db.state.orders[0]?.status, "paid");
  assert.equal(db.state.orders[0]?.orderDate?.toISOString(), "2026-10-01T12:00:00.000Z");
  assert.equal(db.state.invoices.length, 1);
});

test("nome e preço ausentes são null, sem inventar nome nem usar preço zero", async () => {
  const { db, service } = setup();
  const data = input();
  data.order.customer.name = null;
  data.order.items[0]!.unitPrice = null;
  await service.execute(data);
  assert.equal(db.state.customers[0]?.name, null);
  assert.equal(db.state.items[0]?.unitPrice, null);
});

test("novos pedidos com telefone e nome compatíveis reutilizam cliente do mesmo usuário", async () => {
  const { db, service } = setup();
  const first = await service.execute(input());
  const next = input("1002");
  next.marketplaceAccountId = "account-b";
  next.order.customer = { name: "  MARIA   FICTÍCIA  ", phone: "(11) 99999-0000" };
  next.invoice = null;
  const second = await service.execute(next);
  assert.equal(second.customerId, first.customerId);
  assert.equal(db.state.customers.length, 1);
  assert.equal(db.state.orders.length, 2);
  assert.equal(db.state.orders[1]?.marketplaceAccountId, "account-b");
});

test("nome igual sem telefone não deduplica clientes de pedidos distintos", async () => {
  const { db, service } = setup();
  for (const id of ["1001", "1002"]) {
    const data = input(id);
    data.order.customer.phone = null;
    data.invoice = null;
    await service.execute(data);
  }
  assert.equal(db.state.customers.length, 2);
});

test("telefone igual com nomes diferentes mantém clientes separados", async () => {
  const { db, service } = setup();
  await service.execute(input());
  const next = input("1002");
  next.order.customer.name = "João Fictício";
  next.invoice = null;
  await service.execute(next);
  assert.equal(db.state.customers.length, 2);
});

test("telefone sozinho, sem nome suficiente, não une clientes de pedidos diferentes", async () => {
  const { db, service } = setup();
  await service.execute(input());
  const next = input("1002");
  next.order.customer.name = null;
  next.invoice = null;
  await service.execute(next);
  assert.equal(db.state.customers.length, 2);
});

test("clientes de outro usuário não são reutilizados, mesmo com nome e telefone iguais", async () => {
  const { db, service } = setup();
  await service.execute(input());
  const next = input("1002");
  next.marketplaceAccountId = "account-other-user";
  next.userId = "user-b";
  next.invoice = null;
  await service.execute(next);
  assert.equal(db.state.customers.length, 2);
});

test("clientes históricos ambíguos com mesmo nome e telefone não são unidos", async () => {
  const { db, service } = setup();
  const first = await service.execute(input());
  const original = db.state.customers[0];
  const originalOrder = db.state.orders[0];
  assert.ok(original);
  assert.ok(originalOrder);
  db.state.customers.push({ ...original, id: "historical-customer" });
  db.state.orders.push({
    ...originalOrder, id: "historical-order", externalOrderId: "historical",
    customerId: "historical-customer",
  });
  const next = input("1002");
  next.invoice = null;
  const result = await service.execute(next);
  assert.notEqual(result.customerId, first.customerId);
  assert.notEqual(result.customerId, "historical-customer");
  assert.equal(db.state.customers.length, 3);
});

test("mesmo ID externo em duas contas cria pedidos diferentes e preserva seus vínculos", async () => {
  const { db, service } = setup();
  const first = await service.execute(input());
  const next = input();
  next.marketplaceAccountId = "account-b";
  next.invoice = null;
  const second = await service.execute(next);
  assert.notEqual(first.orderId, second.orderId);
  assert.equal(db.state.orders.length, 2);
});

test("telefone recebido depois enriquece o cliente existente, sem criar nova cópia", async () => {
  const { db, service } = setup();
  const initial = input();
  initial.order.customer.phone = null;
  initial.invoice = null;
  const first = await service.execute(initial);
  const next = await service.execute(input());
  assert.equal(first.customerId, next.customerId);
  assert.equal(db.state.customers.length, 1);
  assert.equal(db.state.customers[0]?.normalizedPhone, "5511999990000");
});

test("telefone recebido depois procura cliente compatível já utilizado por outro pedido", async () => {
  const { db, service } = setup();
  const initial = input();
  initial.order.customer.phone = null;
  initial.invoice = null;
  await service.execute(initial);
  const known = input("1002");
  known.invoice = null;
  const other = await service.execute(known);
  const result = await service.execute(input());
  assert.equal(result.customerId, other.customerId);
  assert.equal(db.state.orders[0]?.customerId, db.state.orders[1]?.customerId);
});

test("correção de nome em um pedido não altera cliente compartilhado de outra venda", async () => {
  const { db, service } = setup();
  const first = await service.execute(input());
  const secondInput = input("1002");
  secondInput.invoice = null;
  const second = await service.execute(secondInput);
  assert.equal(first.customerId, second.customerId);
  const changed = input();
  changed.order.customer.name = "Outro Destinatário";
  const corrected = await service.execute(changed);
  assert.notEqual(corrected.customerId, second.customerId);
  assert.equal(db.state.customers.find((row) => row.id === second.customerId)?.name, "Maria Fictícia");
  assert.equal(db.state.orders.find((row) => row.id === second.orderId)?.customerId, second.customerId);
});

test("correção de telefone não altera o cliente compartilhado de outro pedido", async () => {
  const { db, service } = setup();
  const first = await service.execute(input());
  const secondInput = input("1002");
  secondInput.invoice = null;
  await service.execute(secondInput);
  const changed = input();
  changed.order.customer.phone = "5521999990000";
  const corrected = await service.execute(changed);
  assert.notEqual(corrected.customerId, first.customerId);
  assert.equal(db.state.customers.find((row) => row.id === first.customerId)?.normalizedPhone, "5511999990000");
  assert.equal(db.state.orders[1]?.customerId, first.customerId);
});

test("mesma NF-e nunca é movida silenciosamente para outro pedido", async () => {
  const { db, service } = setup();
  const first = await service.execute(input());
  await assert.rejects(service.execute(input("1002")), status(409));
  assert.equal(db.state.orders.length, 1);
  assert.equal(db.state.customers.length, 1);
  assert.equal(db.state.invoices.length, 1);
  assert.equal(db.state.invoices[0]?.orderId, first.orderId);
  assert.equal(db.state.items.length, 2);
});

test("itens reordenados ou preços equivalentes não recriam linhas", async () => {
  const { db, service } = setup();
  await service.execute(input());
  const ids = db.state.items.map((row) => row.id);
  const next = input();
  next.order.items.reverse();
  next.order.items[1]!.unitPrice = "19.9";
  await service.execute(next);
  assert.deepEqual(db.state.items.map((row) => row.id), ids);
});

test("lista completa vazia remove itens antigos sem excluir outros pedidos", async () => {
  const { db, service } = setup();
  await service.execute(input());
  const next = input("1002");
  next.invoice = null;
  const second = await service.execute(next);
  const empty = input();
  empty.order.items = [];
  await service.execute(empty);
  assert.equal(db.state.items.length, 2);
  assert.ok(db.state.items.every((row) => row.orderId === second.orderId));
});

test("falha ao criar produtos reverte cliente, pedido e NF-e da primeira importação", async () => {
  const { db, service } = setup();
  db.failItemWrite = true;
  await assert.rejects(service.execute(input()), status(500));
  assert.equal(db.state.customers.length, 0);
  assert.equal(db.state.orders.length, 0);
  assert.equal(db.state.invoices.length, 0);
  assert.equal(db.state.items.length, 0);
});

test("falha na reimportação preserva produtos e dados antigos por rollback", async () => {
  const { db, service } = setup();
  await service.execute(input());
  const before = { ...db.state };
  const next = input();
  next.order.status = "delivered";
  next.order.customer.name = "Novo Nome";
  next.order.items[0]!.quantity = 5;
  db.failItemWrite = true;
  await assert.rejects(service.execute(next), status(500));
  assert.deepEqual(db.state, before);
});

test("conflitos P2034 e P2002 reexecutam a transação inteira sem registros parciais", async () => {
  for (const code of ["P2034", "P2002"]) {
    const { db, service } = setup();
    db.failuresBeforeCommit.push(code);
    await service.execute(input());
    assert.equal(db.transactionAttempts, 2);
    assert.equal(db.state.customers.length, 1);
    assert.equal(db.state.orders.length, 1);
    assert.equal(db.state.invoices.length, 1);
    assert.equal(db.state.items.length, 2);
  }
});

test("tentativas de conflito são limitadas e não expõem dados do erro Prisma", async () => {
  const { db, service } = setup();
  db.failuresBeforeCommit.push("P2034", "P2034", "P2034", "P2034");
  await assert.rejects(service.execute(input()), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 409);
    assert.ok(!error.message.includes("privado"));
    return true;
  });
  assert.equal(db.transactionAttempts, 4);
  assert.equal(db.state.orders.length, 0);
  assert.equal(db.state.customers.length, 0);
});

test("conta inativa, inexistente, de outro usuário ou plataforma é recusada sem gravar", async () => {
  for (const variant of ["inactive", "missing", "other-user", "platform"]) {
    const { db, service } = setup();
    const data = input();
    if (variant === "inactive") db.state.accounts[0]!.isActive = false;
    if (variant === "missing") data.marketplaceAccountId = "missing";
    if (variant === "other-user") data.marketplaceAccountId = "account-other-user";
    if (variant === "platform") data.order.platform = "MAGALU";
    await assert.rejects(service.execute(data), status(404));
    assert.equal(db.state.orders.length, 0);
    assert.equal(db.state.customers.length, 0);
  }
});

test("dados inválidos e XML no payload são recusados antes de iniciar transação", async () => {
  const { db, service } = setup();
  const wrongPrice = input();
  wrongPrice.order.items[0]!.unitPrice = "19.999";
  await assert.rejects(service.execute(wrongPrice), status(422));
  const wrongInvoice = input();
  assert.ok(wrongInvoice.invoice);
  wrongInvoice.invoice.invoiceKey = "123";
  await assert.rejects(service.execute(wrongInvoice), status(422));
  const withXml = { ...input(), invoice: { ...input().invoice!, xml: "<xml>fictício</xml>" } };
  await assert.rejects(service.execute(withXml), status(422));
  assert.equal(db.transactionAttempts, 0);
});
