"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const AppError_1 = require("../../errors/AppError");
const CustomerQueryService_1 = require("./CustomerQueryService");
const MemoryCustomerQueryDatabase_1 = require("./testing/MemoryCustomerQueryDatabase");
function setup() {
    const db = new MemoryCustomerQueryDatabase_1.MemoryCustomerQueryDatabase();
    return { db, service: new CustomerQueryService_1.CustomerQueryService(db.readTransaction) };
}
(0, node_test_1.test)("busca CPF/CNPJ com ou sem formatação, preservando escopo do usuário", async () => {
    const { db, service } = setup();
    Object.assign(db.customers[0], { document: "12345678900", documentType: "CPF" });
    Object.assign(db.customers[2], { document: "12345678000190", documentType: "CNPJ" });
    Object.assign(db.customers[3], { document: "00123456789", documentType: "CPF" });
    for (const [search, id, type] of [
        ["12345678900", 1, "CPF"], ["123.456.789-00", 1, "CPF"],
        ["12345678000190", 3, "CNPJ"], ["12.345.678/0001-90", 3, "CNPJ"],
    ]) {
        const result = await service.list("user-a", { search });
        strict_1.default.deepEqual(result.data.map((row) => row.customerId), [(0, MemoryCustomerQueryDatabase_1.fixtureId)(id)]);
        strict_1.default.equal(result.data[0]?.documentType, type);
        strict_1.default.ok(result.data[0]?.document);
    }
    strict_1.default.deepEqual((await service.list("user-a", { search: "001.234.567-89" })).data, []);
    const detail = await service.get("user-a", (0, MemoryCustomerQueryDatabase_1.fixtureId)(1));
    strict_1.default.equal(detail.document, "12345678900");
    strict_1.default.equal(detail.documentType, "CPF");
    const missing = await service.get("user-a", (0, MemoryCustomerQueryDatabase_1.fixtureId)(2));
    strict_1.default.equal(missing.document, null);
    strict_1.default.equal(missing.documentType, null);
});
(0, node_test_1.test)("lista somente clientes com pedidos do usuário, uma linha por cliente e sem dados sensíveis", async () => {
    const { db, service } = setup();
    const result = await service.list("user-a", {});
    strict_1.default.deepEqual(result.pagination, { page: 1, limit: 50, total: 5, totalPages: 1 });
    strict_1.default.equal(new Set(result.data.map((row) => row.customerId)).size, 5);
    strict_1.default.ok(!result.data.some((row) => [(0, MemoryCustomerQueryDatabase_1.fixtureId)(4), (0, MemoryCustomerQueryDatabase_1.fixtureId)(5)].includes(row.customerId)));
    const maria = result.data.find((row) => row.customerId === (0, MemoryCustomerQueryDatabase_1.fixtureId)(1));
    strict_1.default.ok(maria);
    strict_1.default.equal(maria.externalOrderId, "MAG-200");
    strict_1.default.equal(maria.marketplaceAccount.id, (0, MemoryCustomerQueryDatabase_1.fixtureId)(20));
    strict_1.default.equal(maria.platform, "MAGALU");
    strict_1.default.deepEqual(Object.keys(maria).sort(), [
        "customerId", "document", "documentType", "externalOrderId", "marketplaceAccount", "name", "normalizedPhone", "orderDate", "phone", "platform",
    ]);
    strict_1.default.equal(JSON.stringify(result).includes("token-"), false);
    strict_1.default.equal(JSON.stringify(result).includes("SECRET-900"), false);
    strict_1.default.equal(JSON.stringify(result).includes("userId"), false);
    strict_1.default.equal(db.calls.count, 1);
    strict_1.default.equal(db.calls.findMany, 1);
    strict_1.default.equal(db.calls.findFirst, 0);
    strict_1.default.deepEqual(db.lastCount?.where, db.lastFindMany?.where);
});
(0, node_test_1.test)("pagina clientes distintos com ordenação estável e informa totalPages", async () => {
    const { service } = setup();
    const first = await service.list("user-a", { page: "1", limit: "2" });
    const second = await service.list("user-a", { page: "2", limit: "2" });
    strict_1.default.deepEqual(first.pagination, { page: 1, limit: 2, total: 5, totalPages: 3 });
    strict_1.default.equal(second.data.length, 2);
    strict_1.default.equal(new Set([...first.data, ...second.data].map((row) => row.customerId)).size, 4);
    const outside = await service.list("user-a", { page: "10", limit: "2" });
    strict_1.default.deepEqual(outside.data, []);
    strict_1.default.equal(outside.pagination.total, 5);
});
(0, node_test_1.test)("busca por nome sem diferenciar caixa e por telefone formatado ou parcial", async () => {
    const { service } = setup();
    for (const search of ["mArIa", "(11) 99999-0000", "+55 11 99999-0000", "999990000"]) {
        const result = await service.list("user-a", { search });
        strict_1.default.deepEqual(result.data.map((row) => row.customerId), [(0, MemoryCustomerQueryDatabase_1.fixtureId)(1)]);
    }
});
(0, node_test_1.test)("busca por pedido seleciona esse pedido, mesmo se há outra venda mais recente", async () => {
    const { service } = setup();
    const result = await service.list("user-a", { search: "ml-100" });
    strict_1.default.equal(result.data.length, 1);
    strict_1.default.equal(result.data[0]?.externalOrderId, "ML-100");
    strict_1.default.equal(result.data[0]?.platform, "MERCADO_LIVRE");
    strict_1.default.equal(result.data[0]?.marketplaceAccount.id, (0, MemoryCustomerQueryDatabase_1.fixtureId)(10));
});
(0, node_test_1.test)("pedido de outro usuário não pode fazer um cliente compartilhado aparecer na busca", async () => {
    const { service } = setup();
    for (const search of ["SECRET-900", "OUTRO-300"]) {
        const result = await service.list("user-a", { search });
        strict_1.default.deepEqual(result.data, []);
        strict_1.default.equal(result.pagination.total, 0);
    }
});
(0, node_test_1.test)("filtros de plataforma, conta e período se aplicam ao mesmo pedido", async () => {
    const { service } = setup();
    const result = await service.list("user-a", {
        platform: "MERCADO_LIVRE", marketplaceAccountId: (0, MemoryCustomerQueryDatabase_1.fixtureId)(10),
        dateFrom: "2026-09-01", dateTo: "2026-09-10", hasPhone: "true", search: "Maria",
    });
    strict_1.default.equal(result.data.length, 1);
    strict_1.default.equal(result.data[0]?.externalOrderId, "ML-100");
    const nonMatching = await service.list("user-a", { platform: "MERCADO_LIVRE", dateFrom: "2026-09-19" });
    strict_1.default.equal(nonMatching.data.length, 0);
});
(0, node_test_1.test)("filtrar uma conta alheia ou não existente retorna lista vazia", async () => {
    const { service } = setup();
    for (const marketplaceAccountId of [(0, MemoryCustomerQueryDatabase_1.fixtureId)(30), (0, MemoryCustomerQueryDatabase_1.fixtureId)(99)]) {
        const result = await service.list("user-a", { marketplaceAccountId });
        strict_1.default.deepEqual(result.data, []);
        strict_1.default.equal(result.pagination.total, 0);
    }
});
(0, node_test_1.test)("hasPhone true/false separa clientes e mantém campos opcionais null", async () => {
    const { service } = setup();
    const withPhone = await service.list("user-a", { hasPhone: "true" });
    const withoutPhone = await service.list("user-a", { hasPhone: "false" });
    strict_1.default.equal(withPhone.pagination.total, 2);
    strict_1.default.equal(withoutPhone.pagination.total, 3);
    strict_1.default.ok(withPhone.data.every((row) => row.normalizedPhone !== null));
    strict_1.default.ok(withoutPhone.data.every((row) => row.phone === null && row.normalizedPhone === null));
    strict_1.default.ok(withoutPhone.data.some((row) => row.name === null && row.orderDate === null));
});
(0, node_test_1.test)("preserva acesso ao histórico de uma conta do usuário desconectada", async () => {
    const { service } = setup();
    const result = await service.list("user-a", { marketplaceAccountId: (0, MemoryCustomerQueryDatabase_1.fixtureId)(40) });
    strict_1.default.equal(result.data[0]?.externalOrderId, "ML-OLD");
});
(0, node_test_1.test)("datas são inclusivas; data sem fuso usa dia UTC inteiro; pedidos sem data não passam pelo filtro", async () => {
    const { db, service } = setup();
    db.orders.find((row) => row.externalOrderId === "ML-101").orderDate = new Date("2026-09-15T23:59:59.999Z");
    const result = await service.list("user-a", { dateFrom: "2026-09-15", dateTo: "2026-09-15" });
    strict_1.default.deepEqual(result.data.map((row) => row.customerId), [(0, MemoryCustomerQueryDatabase_1.fixtureId)(2)]);
    const exact = await service.list("user-a", { dateFrom: "2026-09-15T20:59:59.999-03:00", dateTo: "2026-09-15T20:59:59.999-03:00" });
    strict_1.default.equal(exact.data.length, 1);
});
(0, node_test_1.test)("busca vazia não filtra; curingas SQL são tratados como caracteres literais", async () => {
    const { db, service } = setup();
    strict_1.default.equal((await service.list("user-a", { search: "  " })).pagination.total, 5);
    strict_1.default.equal((await service.list("user-a", { search: "%" })).pagination.total, 0);
    db.customers[0].name = "Cliente_100% Fictício";
    strict_1.default.equal((await service.list("user-a", { search: "_100%" })).pagination.total, 1);
});
(0, node_test_1.test)("detalhes usam o vínculo do usuário e mostram somente um pedido autorizado", async () => {
    const { db, service } = setup();
    const result = await service.get("user-a", (0, MemoryCustomerQueryDatabase_1.fixtureId)(1));
    strict_1.default.equal(result.customerId, (0, MemoryCustomerQueryDatabase_1.fixtureId)(1));
    strict_1.default.equal(result.externalOrderId, "MAG-200");
    strict_1.default.equal(JSON.stringify(result).includes("token-"), false);
    strict_1.default.equal(db.calls.findFirst, 1);
    strict_1.default.equal(db.calls.findMany + db.calls.count, 0);
});
(0, node_test_1.test)("detalhes alheios, inexistentes ou sem pedido autorizado retornam o mesmo 404", async () => {
    const { service } = setup();
    for (const id of [(0, MemoryCustomerQueryDatabase_1.fixtureId)(4), (0, MemoryCustomerQueryDatabase_1.fixtureId)(5), (0, MemoryCustomerQueryDatabase_1.fixtureId)(99)]) {
        await strict_1.default.rejects(service.get("user-a", id), (error) => error instanceof AppError_1.AppError && error.statusCode === 404 && error.message === "Cliente não encontrado");
    }
});
(0, node_test_1.test)("falhas no banco são sanitizadas em ambas as consultas", async () => {
    const { db, service } = setup();
    db.fail = true;
    for (const operation of [() => service.list("user-a", {}), () => service.get("user-a", (0, MemoryCustomerQueryDatabase_1.fixtureId)(1))]) {
        await strict_1.default.rejects(operation(), (error) => error instanceof AppError_1.AppError && error.statusCode === 503 && !error.message.includes("SQL"));
    }
});
(0, node_test_1.test)("rejeita usuário ausente antes de consultar o banco", async () => {
    const { db, service } = setup();
    await strict_1.default.rejects(service.list("", {}));
    await strict_1.default.rejects(service.get("", (0, MemoryCustomerQueryDatabase_1.fixtureId)(1)));
    strict_1.default.equal(db.calls.transactions, 0);
});
//# sourceMappingURL=CustomerQueryService.test.js.map