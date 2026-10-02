"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_test_1 = require("node:test");
const AppError_1 = require("../../errors/AppError");
const mercadoLivreOrderService_1 = require("../../integrations/mercadolivre/mercadoLivreOrderService");
const ImportedOrderPersistenceService_1 = require("./ImportedOrderPersistenceService");
const MercadoLivreImportService_1 = require("./MercadoLivreImportService");
const MemoryPersistenceDatabase_1 = require("./testing/MemoryPersistenceDatabase");
const input = {
    marketplaceAccountId: "account-a", userId: "user-a",
    dateFrom: new Date("2026-09-01T00:00:00Z"), dateTo: new Date("2026-09-30T23:59:59Z"),
};
const xml = (0, node_fs_1.readFileSync)("services/invoices/fixtures/nfe-with-phone.xml", "utf8");
function order(id) {
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
class MemoryImports {
    records = [];
    updates = [];
    async ownsActiveAccount(accountId, userId) {
        return accountId === "account-a" && userId === "user-a";
    }
    async create(accountId) {
        const record = {
            id: `import-${this.records.length + 1}`, marketplaceAccountId: accountId,
            status: "PROCESSING", startedAt: new Date(), finishedAt: null,
            ordersFound: 0, ordersProcessed: 0, customersWithPhone: 0, customersWithoutPhone: 0, errorsCount: 0,
        };
        this.records.push(record);
        return { ...record };
    }
    async update(id, data) {
        const record = this.records.find((row) => row.id === id);
        strict_1.default.ok(record);
        Object.assign(record, data);
        this.updates.push({ ...record });
        return { ...record };
    }
}
function setup(pages = [[order("1"), order("2")]]) {
    const storage = new MemoryImports();
    const saved = [];
    const invoiceCalls = [];
    const dependencies = {
        storage,
        orders: { async *getOrders() {
                strict_1.default.equal(storage.records.at(-1)?.status, "PROCESSING");
                for (const page of pages)
                    yield page;
            } },
        recipients: { async getRecipient(_accountId, current) {
                return { name: "Maria Fictícia", phone: current.externalOrderId === "1" ? "11999990000" : null,
                    document: current.externalOrderId === "1" ? "12345678900" : null };
            } },
        invoices: { async getInvoiceXml(request) {
                invoiceCalls.push(request.externalOrderId);
                return null;
            } },
        persistence: { async execute(data) {
                saved.push(data);
                return {
                    orderId: data.order.externalOrderId, customerId: "customer", invoiceId: null,
                    created: true, itemsCount: data.order.items.length, customerHasPhone: data.order.customer.phone !== null,
                };
            } },
    };
    return { storage, saved, invoiceCalls, dependencies };
}
(0, node_test_1.test)("cria PROCESSING antes da busca, registra encontrados e conclui resumo SUCCESS", async () => {
    const { storage, saved, invoiceCalls, dependencies } = setup();
    const result = await new MercadoLivreImportService_1.MercadoLivreImportService(dependencies).execute(input);
    strict_1.default.equal(result.status, "SUCCESS");
    strict_1.default.ok(result.finishedAt);
    strict_1.default.equal(result.ordersFound, 2);
    strict_1.default.equal(result.ordersProcessed, 2);
    strict_1.default.equal(result.customersWithPhone, 1);
    strict_1.default.equal(result.customersWithoutPhone, 1);
    strict_1.default.equal(result.errorsCount, 0);
    strict_1.default.equal(storage.updates[0]?.ordersProcessed, 0);
    strict_1.default.equal(storage.updates[0]?.ordersFound, 2);
    strict_1.default.deepEqual(invoiceCalls, ["2"]);
    strict_1.default.equal(saved[0]?.order.customer.phone, "5511999990000");
    strict_1.default.ok(saved.every((data) => data.marketplaceAccountId === input.marketplaceAccountId && data.userId === input.userId));
});
(0, node_test_1.test)("usa parser real uma vez, extrai telefone e passa somente dados fiscais à persistência", async () => {
    const { saved, dependencies } = setup([[order("2")]]);
    dependencies.invoices.getInvoiceXml = async () => xml;
    const result = await new MercadoLivreImportService_1.MercadoLivreImportService(dependencies).execute(input);
    strict_1.default.equal(result.customersWithPhone, 1);
    strict_1.default.equal(result.customersWithoutPhone, 0);
    strict_1.default.ok(saved[0]?.invoice?.invoiceKey);
    strict_1.default.ok(saved[0]?.order.customer.phone?.startsWith("55"));
    strict_1.default.equal(JSON.stringify(saved).includes("<"), false);
});
(0, node_test_1.test)("pedido sem NF-e nem telefone é salvo e contado sem telefone", async () => {
    const { dependencies, saved } = setup([[order("2")]]);
    const result = await new MercadoLivreImportService_1.MercadoLivreImportService(dependencies).execute(input);
    strict_1.default.equal(result.status, "SUCCESS");
    strict_1.default.equal(result.customersWithoutPhone, 1);
    strict_1.default.equal(saved[0]?.invoice, null);
});
(0, node_test_1.test)("importa documento da NF-e mesmo quando pedido já informa telefone", async () => {
    const { saved, dependencies } = setup([[order("1")]]);
    dependencies.recipients.getRecipient = async () => ({ name: "Maria", phone: "11999999999", document: null });
    dependencies.invoices.getInvoiceXml = async () => xml;
    const result = await new MercadoLivreImportService_1.MercadoLivreImportService(dependencies).execute(input);
    strict_1.default.equal(result.status, "SUCCESS");
    strict_1.default.equal(saved[0]?.order.customer.document, "00000000000");
    strict_1.default.equal(saved[0]?.order.customer.documentType, "CPF");
    strict_1.default.equal(saved[0]?.order.customer.phone, "5511999999999");
    strict_1.default.ok(saved[0]?.invoice);
});
for (const stage of ["recipient", "invoice", "xml", "persistence"]) {
    (0, node_test_1.test)(`falha em ${stage} produz PARTIAL_SUCCESS e não impede próximo pedido`, async () => {
        const { dependencies, saved } = setup([[order("2"), order("1")]]);
        if (stage === "recipient")
            dependencies.recipients.getRecipient = async (_id, current) => {
                if (current.externalOrderId === "2")
                    throw new Error("dados privados fictícios");
                return { name: "Maria Fictícia", phone: "11999990000" };
            };
        if (stage === "invoice")
            dependencies.invoices.getInvoiceXml = async () => { throw new Error("token fictício"); };
        if (stage === "xml")
            dependencies.invoices.getInvoiceXml = async () => "<XML inválido";
        if (stage === "persistence") {
            const save = dependencies.persistence.execute;
            dependencies.persistence.execute = async (data) => {
                if (data.order.externalOrderId === "2")
                    throw new Error("SQL privado fictício");
                return save(data);
            };
        }
        const result = await new MercadoLivreImportService_1.MercadoLivreImportService({ ...dependencies, concurrency: 1 }).execute(input);
        strict_1.default.equal(result.status, "PARTIAL_SUCCESS");
        strict_1.default.equal(result.ordersFound, 2);
        strict_1.default.equal(result.ordersProcessed, 1);
        strict_1.default.equal(result.errorsCount, 1);
        strict_1.default.deepEqual(saved.map((data) => data.order.externalOrderId), ["1"]);
        strict_1.default.equal(JSON.stringify(result).includes("privado"), false);
    });
}
(0, node_test_1.test)("todos os pedidos falham: ERROR, sem contagem de clientes salvos", async () => {
    const { dependencies } = setup();
    dependencies.persistence.execute = async () => { throw new Error("indisponível"); };
    const result = await new MercadoLivreImportService_1.MercadoLivreImportService(dependencies).execute(input);
    strict_1.default.equal(result.status, "ERROR");
    strict_1.default.equal(result.ordersProcessed, 0);
    strict_1.default.equal(result.errorsCount, 2);
    strict_1.default.equal(result.customersWithPhone + result.customersWithoutPhone, 0);
});
for (const initialPage of [false, true]) {
    (0, node_test_1.test)(`falha de paginação ${initialPage ? "após sucesso" : "antes dos pedidos"} finaliza registro`, async () => {
        const { dependencies } = setup();
        dependencies.orders.getOrders = async function* () {
            if (initialPage)
                yield [order("1")];
            throw new Error("erro privado da API");
        };
        const result = await new MercadoLivreImportService_1.MercadoLivreImportService(dependencies).execute(input);
        strict_1.default.equal(result.status, initialPage ? "PARTIAL_SUCCESS" : "ERROR");
        strict_1.default.equal(result.ordersFound, initialPage ? 1 : 0);
        strict_1.default.equal(result.ordersProcessed, initialPage ? 1 : 0);
        strict_1.default.equal(result.errorsCount, 1);
        strict_1.default.ok(result.finishedAt);
    });
}
(0, node_test_1.test)("período vazio termina SUCCESS com todos os contadores zerados", async () => {
    const { dependencies } = setup([]);
    const result = await new MercadoLivreImportService_1.MercadoLivreImportService(dependencies).execute(input);
    strict_1.default.equal(result.status, "SUCCESS");
    strict_1.default.equal(result.ordersFound + result.ordersProcessed + result.errorsCount, 0);
});
(0, node_test_1.test)("limita paralelismo e registra progresso entre lotes e páginas", async () => {
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
    const result = await new MercadoLivreImportService_1.MercadoLivreImportService({ ...dependencies, concurrency: 3, batchSize: 7 }).execute(input);
    strict_1.default.equal(peak, 3);
    strict_1.default.equal(result.ordersProcessed, 24);
    strict_1.default.ok(storage.updates.some((row) => row.ordersProcessed === 7));
    strict_1.default.ok(storage.updates.some((row) => row.ordersProcessed === 14));
    strict_1.default.ok(storage.updates.some((row) => row.ordersProcessed === 21));
});
(0, node_test_1.test)("IDs repetidos entre páginas são processados e contados somente uma vez", async () => {
    const { dependencies, saved } = setup([[order("1"), order("1")], [order("1"), order("2")]]);
    const result = await new MercadoLivreImportService_1.MercadoLivreImportService(dependencies).execute(input);
    strict_1.default.equal(result.ordersFound, 2);
    strict_1.default.equal(result.ordersProcessed, 2);
    strict_1.default.equal(saved.length, 2);
});
(0, node_test_1.test)("não cria importação nem consulta API para conta de outro usuário", async () => {
    const { dependencies, storage } = setup();
    await strict_1.default.rejects(new MercadoLivreImportService_1.MercadoLivreImportService(dependencies).execute({ ...input, userId: "user-b" }), (error) => error instanceof AppError_1.AppError && error.statusCode === 404);
    strict_1.default.equal(storage.records.length, 0);
});
(0, node_test_1.test)("valida período antes de criar registro", async () => {
    const { dependencies, storage } = setup();
    const service = new MercadoLivreImportService_1.MercadoLivreImportService(dependencies);
    await strict_1.default.rejects(service.execute({ ...input, dateFrom: input.dateTo, dateTo: input.dateFrom }));
    await strict_1.default.rejects(service.execute({ ...input, dateFrom: new Date("inválida") }));
    strict_1.default.equal(storage.records.length, 0);
});
(0, node_test_1.test)("bloqueia importações simultâneas da mesma conta e libera após concluir", async () => {
    const { dependencies, storage } = setup();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    dependencies.orders.getOrders = async function* () { await gate; yield [order("1")]; };
    const service = new MercadoLivreImportService_1.MercadoLivreImportService(dependencies);
    const first = service.execute(input);
    while (storage.records.length === 0)
        await new Promise((resolve) => setImmediate(resolve));
    await strict_1.default.rejects(service.execute(input), (error) => error instanceof AppError_1.AppError && error.statusCode === 409);
    release();
    await first;
    await service.execute(input);
    strict_1.default.equal(storage.records.length, 2);
});
(0, node_test_1.test)("falha ao finalizar é devolvida como erro seguro, sem resumo fictício de sucesso", async () => {
    const { dependencies } = setup([]);
    dependencies.storage.update = async () => { throw new Error("SQL e informações privadas"); };
    await strict_1.default.rejects(new MercadoLivreImportService_1.MercadoLivreImportService(dependencies).execute(input), (error) => error instanceof AppError_1.AppError && error.statusCode === 503 && !error.message.includes("SQL"));
});
(0, node_test_1.test)("coordena extração e persistência reais: reimportação mantém um pedido, nota e produtos", async () => {
    const { dependencies, storage } = setup([[order("2")]]);
    const db = new MemoryPersistenceDatabase_1.MemoryPersistenceDatabase();
    dependencies.invoices.getInvoiceXml = async () => xml;
    const persistence = new ImportedOrderPersistenceService_1.ImportedOrderPersistenceService({ runTransaction: db.runTransaction });
    const service = new MercadoLivreImportService_1.MercadoLivreImportService({ ...dependencies, persistence, concurrency: 1 });
    await service.execute(input);
    await service.execute(input);
    strict_1.default.equal(db.state.orders.length, 1);
    strict_1.default.equal(db.state.invoices.length, 1);
    strict_1.default.equal(db.state.customers.length, 1);
    strict_1.default.equal(db.state.items.length, 2);
    strict_1.default.equal(storage.records.length, 2);
    strict_1.default.ok(storage.records.every((row) => row.ordersProcessed === 1 && row.status === "SUCCESS"));
});
(0, node_test_1.test)("contador considera telefone preservado no banco quando a fonte atual não o informa", async () => {
    const { dependencies } = setup([[order("2")]]);
    const db = new MemoryPersistenceDatabase_1.MemoryPersistenceDatabase();
    const persistence = new ImportedOrderPersistenceService_1.ImportedOrderPersistenceService({ runTransaction: db.runTransaction });
    await persistence.execute({
        marketplaceAccountId: input.marketplaceAccountId, userId: input.userId,
        order: { ...order("2"), customer: { name: "Maria Fictícia", phone: "11999990000" } },
    });
    const result = await new MercadoLivreImportService_1.MercadoLivreImportService({ ...dependencies, persistence }).execute(input);
    strict_1.default.equal(result.customersWithPhone, 1);
    strict_1.default.equal(result.customersWithoutPhone, 0);
    strict_1.default.equal(db.state.customers.length, 1);
});
for (const includeValid of [true, false]) {
    (0, node_test_1.test)(`pedido inválido na busca é contado e isolado (${includeValid ? "com outro válido" : "sozinho"})`, async () => {
        const { dependencies } = setup();
        const orders = new mercadoLivreOrderService_1.MercadoLivreOrderService({
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
        const result = await new MercadoLivreImportService_1.MercadoLivreImportService({ ...dependencies, orders }).execute(input);
        strict_1.default.equal(result.status, includeValid ? "PARTIAL_SUCCESS" : "ERROR");
        strict_1.default.equal(result.ordersFound, includeValid ? 2 : 1);
        strict_1.default.equal(result.ordersProcessed, includeValid ? 1 : 0);
        strict_1.default.equal(result.errorsCount, 1);
    });
}
//# sourceMappingURL=MercadoLivreImportService.test.js.map