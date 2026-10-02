"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryPersistenceDatabase = void 0;
const client_1 = require("../../../generated/prisma/client");
function copy(state) {
    return {
        accounts: state.accounts.map((row) => ({ ...row })),
        customers: state.customers.map((row) => ({ ...row })),
        orders: state.orders.map((row) => ({ ...row })),
        invoices: state.invoices.map((row) => ({ ...row })),
        items: state.items.map((row) => ({ ...row })),
    };
}
function databaseError(code) {
    return new client_1.Prisma.PrismaClientKnownRequestError("payload privado fictício", {
        code, clientVersion: "7.10.0",
    });
}
/** Double de testes: verifica o estado e rollback; não simula locks do PostgreSQL. */
class MemoryPersistenceDatabase {
    state = {
        accounts: [
            { id: "account-a", userId: "user-a", platform: "MERCADO_LIVRE", isActive: true },
            { id: "account-b", userId: "user-a", platform: "MERCADO_LIVRE", isActive: true },
            { id: "account-other-user", userId: "user-b", platform: "MERCADO_LIVRE", isActive: true },
        ],
        customers: [], orders: [], invoices: [], items: [],
    };
    transactionAttempts = 0;
    failuresBeforeCommit = [];
    failItemWrite = false;
    sequence = 0;
    runTransaction = async (work) => {
        this.transactionAttempts++;
        const pending = copy(this.state);
        const result = await work(this.transaction(pending));
        const failure = this.failuresBeforeCommit.shift();
        if (failure)
            throw databaseError(failure);
        this.state = pending;
        return result;
    };
    id(prefix) {
        return `${prefix}-${++this.sequence}`;
    }
    transaction(state) {
        const now = () => new Date(1_790_856_000_000 + this.sequence);
        const tx = {
            marketplaceAccount: {
                findFirst: async ({ where }) => state.accounts.find((account) => account.id === where.id && account.userId === where.userId &&
                    account.platform === where.platform && account.isActive === where.isActive) ?? null,
            },
            customer: {
                findMany: async ({ where }) => state.customers.filter((customer) => customer.normalizedPhone === where.normalizedPhone && customer.id !== where.id?.not &&
                    state.orders.some((order) => order.customerId === customer.id &&
                        state.accounts.some((account) => account.id === order.marketplaceAccountId &&
                            account.userId === where.orders.some.marketplaceAccount.userId))),
                create: async ({ data }) => {
                    const customer = { ...data, id: this.id("customer"), createdAt: now(), updatedAt: now() };
                    state.customers.push(customer);
                    return customer;
                },
                update: async ({ where, data }) => {
                    const index = state.customers.findIndex((row) => row.id === where.id);
                    const previous = state.customers[index];
                    if (!previous)
                        throw databaseError("P2025");
                    const customer = { ...previous, ...data, updatedAt: now() };
                    state.customers[index] = customer;
                    return customer;
                },
            },
            order: {
                findUnique: async ({ where }) => {
                    const key = where.marketplaceAccountId_externalOrderId;
                    const order = state.orders.find((row) => row.marketplaceAccountId === key.marketplaceAccountId &&
                        row.externalOrderId === key.externalOrderId);
                    if (!order)
                        return null;
                    const customer = state.customers.find((row) => row.id === order.customerId);
                    if (!customer)
                        throw databaseError("P2003");
                    return {
                        ...order,
                        customer: { ...customer, _count: { orders: state.orders.filter((row) => row.customerId === customer.id).length } },
                    };
                },
                create: async ({ data }) => {
                    if (state.orders.some((row) => row.marketplaceAccountId === data.marketplaceAccountId &&
                        row.externalOrderId === data.externalOrderId))
                        throw databaseError("P2002");
                    const order = { ...data, id: this.id("order"), createdAt: now(), updatedAt: now() };
                    state.orders.push(order);
                    return order;
                },
                update: async ({ where, data }) => {
                    const index = state.orders.findIndex((row) => row.id === where.id);
                    const previous = state.orders[index];
                    if (!previous)
                        throw databaseError("P2025");
                    const order = { ...previous, ...data, updatedAt: now() };
                    state.orders[index] = order;
                    return order;
                },
            },
            invoice: {
                findUnique: async ({ where }) => state.invoices.find((row) => row.invoiceKey === where.invoiceKey) ?? null,
                create: async ({ data }) => {
                    if (state.invoices.some((row) => row.invoiceKey === data.invoiceKey))
                        throw databaseError("P2002");
                    const invoice = { ...data, id: this.id("invoice"), processedAt: now() };
                    state.invoices.push(invoice);
                    return invoice;
                },
                update: async ({ where, data }) => {
                    const index = state.invoices.findIndex((row) => row.id === where.id);
                    const previous = state.invoices[index];
                    if (!previous)
                        throw databaseError("P2025");
                    const invoice = { ...previous, ...data };
                    state.invoices[index] = invoice;
                    return invoice;
                },
            },
            orderItem: {
                findMany: async ({ where }) => state.items.filter((row) => row.orderId === where.orderId),
                deleteMany: async ({ where }) => {
                    const previous = state.items.length;
                    state.items = state.items.filter((row) => row.orderId !== where.orderId);
                    return { count: previous - state.items.length };
                },
                createMany: async ({ data }) => {
                    if (this.failItemWrite)
                        throw databaseError("P2003");
                    for (const item of data)
                        state.items.push({
                            ...item, id: this.id("item"),
                            unitPrice: item.unitPrice === null ? null : new client_1.Prisma.Decimal(item.unitPrice),
                        });
                    return { count: data.length };
                },
            },
        };
        // Os delegates completos do Prisma são genéricos e têm métodos fora deste double.
        // O serviço de produção continua checado contra Prisma.TransactionClient.
        return tx;
    }
}
exports.MemoryPersistenceDatabase = MemoryPersistenceDatabase;
//# sourceMappingURL=MemoryPersistenceDatabase.js.map