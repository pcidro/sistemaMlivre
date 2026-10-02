"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryCustomerQueryDatabase = exports.fixtureId = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const fixtureId = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
exports.fixtureId = fixtureId;
function matchesText(value, predicate) {
    if (predicate === undefined)
        return true;
    if (predicate === null || typeof predicate === "string")
        return value === predicate;
    const filter = predicate;
    if ("not" in filter && value === filter.not)
        return false;
    if (filter.contains !== undefined) {
        if (value === null)
            return false;
        const text = filter.contains.replace(/\\([\\%_])/g, "$1");
        return filter.mode === "insensitive"
            ? value.toLowerCase().includes(text.toLowerCase()) : value.includes(text);
    }
    return true;
}
/** Avalia apenas os filtros usados nestas consultas; não substitui PostgreSQL. */
class MemoryCustomerQueryDatabase {
    calls = { count: 0, findMany: 0, findFirst: 0, transactions: 0 };
    lastFindMany;
    lastCount;
    lastFindFirst;
    fail = false;
    customers = [
        { id: (0, exports.fixtureId)(1), name: "Maria Fictícia", phone: "5511999990000", normalizedPhone: "5511999990000" },
        { id: (0, exports.fixtureId)(2), name: "João Fictício", phone: null, normalizedPhone: null },
        { id: (0, exports.fixtureId)(3), name: "Ana Fictícia", phone: "5521888880000", normalizedPhone: "5521888880000" },
        { id: (0, exports.fixtureId)(4), name: "Pessoa de outro usuário", phone: "5511999990000", normalizedPhone: "5511999990000" },
        { id: (0, exports.fixtureId)(5), name: "Cliente sem pedidos", phone: null, normalizedPhone: null },
        { id: (0, exports.fixtureId)(6), name: "Zélia Fictícia", phone: null, normalizedPhone: null },
        { id: (0, exports.fixtureId)(7), name: null, phone: null, normalizedPhone: null },
    ];
    accounts = [10, 20, 30, 40].map((number) => ({
        id: (0, exports.fixtureId)(number), userId: number === 30 ? "user-b" : "user-a",
        name: `Conta fictícia ${number}`, cnpj: null, isActive: number !== 40,
        accessTokenEncrypted: "token-acesso-ficticio-nao-expor",
        refreshTokenEncrypted: "token-renovacao-ficticio-nao-expor",
    }));
    orders = [
        this.order(101, 1, 10, "ML-100", "2026-09-05"),
        this.order(102, 1, 20, "MAG-200", "2026-09-20", "MAGALU"),
        this.order(103, 1, 30, "SECRET-900", "2026-10-01"),
        this.order(104, 2, 10, "ML-101", "2026-09-15"),
        this.order(105, 3, 20, "MAG-201", "2026-09-25", "MAGALU"),
        this.order(106, 4, 30, "OUTRO-300", "2026-09-10"),
        this.order(107, 6, 40, "ML-OLD", "2026-09-18"),
        this.order(108, 7, 10, "ML-SEM-DATA", null),
    ];
    order(id, customerId, accountId, externalOrderId, date, platform = "MERCADO_LIVRE") {
        return {
            id: (0, exports.fixtureId)(id), customerId: (0, exports.fixtureId)(customerId), marketplaceAccountId: (0, exports.fixtureId)(accountId),
            externalOrderId, platform, orderDate: date ? new Date(`${date}T12:00:00Z`) : null,
            createdAt: new Date("2026-10-01T12:00:00Z"),
        };
    }
    matchesOrder(order, where) {
        const account = this.accounts.find((row) => row.id === order.marketplaceAccountId);
        if (!account)
            return false;
        const accountWhere = where.marketplaceAccount;
        if (accountWhere && !matchesText(account.userId, accountWhere.userId))
            return false;
        if (!matchesText(order.platform, where.platform) ||
            !matchesText(order.marketplaceAccountId, where.marketplaceAccountId) ||
            !matchesText(order.externalOrderId, where.externalOrderId))
            return false;
        if (where.orderDate) {
            const date = where.orderDate;
            if (!order.orderDate || date.gte && order.orderDate < date.gte || date.lte && order.orderDate > date.lte)
                return false;
        }
        if (where.customer) {
            const customer = this.customers.find((row) => row.id === order.customerId);
            if (!customer || !this.matchesCustomer(customer, where.customer))
                return false;
        }
        if (where.OR && !where.OR.some((condition) => this.matchesOrder(order, condition)))
            return false;
        return true;
    }
    matchesCustomer(customer, where = {}) {
        if (!matchesText(customer.id, where.id) || !matchesText(customer.name, where.name) ||
            !matchesText(customer.phone, where.phone) || !matchesText(customer.normalizedPhone, where.normalizedPhone) ||
            !matchesText(customer.document ?? null, where.document))
            return false;
        if (where.AND) {
            const conditions = Array.isArray(where.AND) ? where.AND : [where.AND];
            if (!conditions.every((condition) => this.matchesCustomer(customer, condition)))
                return false;
        }
        if (where.OR && !where.OR.some((condition) => this.matchesCustomer(customer, condition)))
            return false;
        if (where.orders?.some && !this.orders.some((order) => order.customerId === customer.id &&
            this.matchesOrder(order, where.orders.some)))
            return false;
        return true;
    }
    project(customer, select) {
        strict_1.default.ok(select && typeof select.orders === "object");
        const ordersSelection = select.orders;
        strict_1.default.deepEqual(Object.keys(select).sort(), ["document", "documentType", "id", "name", "normalizedPhone", "orders", "phone"]);
        strict_1.default.equal(ordersSelection.take, 1);
        const orderSelect = ordersSelection.select;
        strict_1.default.ok(orderSelect && typeof orderSelect.marketplaceAccount === "object");
        strict_1.default.deepEqual(Object.keys(orderSelect.marketplaceAccount.select).sort(), ["cnpj", "id", "name"]);
        const orders = this.orders.filter((order) => order.customerId === customer.id &&
            this.matchesOrder(order, ordersSelection.where ?? {}));
        orders.sort((left, right) => {
            if (left.orderDate === null && right.orderDate !== null)
                return 1;
            if (right.orderDate === null && left.orderDate !== null)
                return -1;
            return (right.orderDate?.getTime() ?? 0) - (left.orderDate?.getTime() ?? 0) ||
                right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id);
        });
        return {
            ...customer,
            document: customer.document ?? null,
            documentType: customer.documentType ?? null,
            orders: orders.slice(0, ordersSelection.take).map((order) => ({
                ...order,
                // Devolve extras fictícios para também verificar a proteção do DTO.
                marketplaceAccount: this.accounts.find((account) => account.id === order.marketplaceAccountId),
            })),
        };
    }
    readTransaction = async (work) => {
        this.calls.transactions++;
        if (this.fail)
            throw new Error("SQL contendo valores privados fictícios");
        const tx = {
            customer: {
                count: async (args) => {
                    this.calls.count++;
                    this.lastCount = args;
                    return this.customers.filter((row) => this.matchesCustomer(row, args.where)).length;
                },
                findMany: async (args) => {
                    this.calls.findMany++;
                    this.lastFindMany = args;
                    strict_1.default.deepEqual(args.orderBy, [{ name: { sort: "asc", nulls: "last" } }, { id: "asc" }]);
                    const rows = this.customers.filter((row) => this.matchesCustomer(row, args.where));
                    rows.sort((left, right) => {
                        if (left.name === null && right.name !== null)
                            return 1;
                        if (right.name === null && left.name !== null)
                            return -1;
                        return (left.name ?? "").localeCompare(right.name ?? "") || left.id.localeCompare(right.id);
                    });
                    return rows.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? rows.length)).map((row) => this.project(row, args.select));
                },
                findFirst: async (args) => {
                    this.calls.findFirst++;
                    this.lastFindFirst = args;
                    const row = this.customers.find((customer) => this.matchesCustomer(customer, args.where));
                    return row ? this.project(row, args.select) : null;
                },
            },
        };
        return work(tx);
    };
}
exports.MemoryCustomerQueryDatabase = MemoryCustomerQueryDatabase;
//# sourceMappingURL=MemoryCustomerQueryDatabase.js.map