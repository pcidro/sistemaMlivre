"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerQueryService = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const client_1 = require("../../generated/prisma/client");
const prisma_1 = require("../../lib/prisma");
const customerSchemas_1 = require("../../schemas/customerSchemas");
const normalizeDocument_1 = require("../../utils/normalizeDocument");
function literalSearch(value) {
    // contains usa LIKE/ILIKE no PostgreSQL: tratar curingas como texto da busca.
    return value.replace(/[\\%_]/g, "\\$&");
}
function orderFilter(userId, filters) {
    const where = { marketplaceAccount: { userId } };
    if (!filters)
        return where;
    if (filters.platform)
        where.platform = filters.platform;
    if (filters.marketplaceAccountId)
        where.marketplaceAccountId = filters.marketplaceAccountId;
    if (filters.dateFrom || filters.dateTo) {
        where.orderDate = {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
        };
    }
    if (filters.search) {
        const text = literalSearch(filters.search);
        const document = (0, normalizeDocument_1.normalizeDocument)(filters.search);
        const customerSearch = [
            { name: { contains: text, mode: "insensitive" } },
            { phone: { contains: text, mode: "insensitive" } },
            { normalizedPhone: { contains: text } },
            { document: document ?? { contains: text } },
        ];
        if (/^[+\d\s()./-]+$/.test(filters.search)) {
            const digits = filters.search.replace(/\D/g, "");
            if (digits) {
                customerSearch.push({ normalizedPhone: { contains: digits } }, { phone: { contains: digits } });
                if (!document)
                    customerSearch.push({ document: { contains: digits } });
            }
        }
        where.OR = [
            { externalOrderId: { contains: text, mode: "insensitive" } },
            { customer: { OR: customerSearch } },
        ];
    }
    return where;
}
function customerSelect(ordersWhere) {
    return {
        id: true, name: true, phone: true, normalizedPhone: true,
        document: true, documentType: true,
        orders: {
            where: ordersWhere,
            take: 1,
            orderBy: [
                { orderDate: { sort: "desc", nulls: "last" } },
                { createdAt: "desc" }, { id: "desc" },
            ],
            select: {
                externalOrderId: true, orderDate: true, platform: true,
                marketplaceAccount: { select: { id: true, name: true, cnpj: true } },
            },
        },
    };
}
function toCustomerResult(row) {
    const order = row.orders[0];
    if (!order)
        throw new AppError_1.AppError("Não foi possível consultar os dados do cliente", 503);
    return {
        customerId: row.id, name: row.name, phone: row.phone, normalizedPhone: row.normalizedPhone,
        document: row.document, documentType: row.documentType,
        platform: order.platform,
        marketplaceAccount: {
            id: order.marketplaceAccount.id,
            name: order.marketplaceAccount.name,
            cnpj: order.marketplaceAccount.cnpj,
        },
        externalOrderId: order.externalOrderId, orderDate: order.orderDate,
    };
}
class CustomerQueryService {
    readTransaction;
    constructor(readTransaction = (work) => prisma_1.prisma.$transaction(work, {
        isolationLevel: client_1.Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 5_000, timeout: 10_000,
    })) {
        this.readTransaction = readTransaction;
    }
    async list(userId, query) {
        userId = zod_1.z.string().trim().min(1).parse(userId);
        const filters = customerSchemas_1.customerListQuerySchema.parse(query);
        const ordersWhere = orderFilter(userId, filters);
        const where = { orders: { some: ordersWhere } };
        if (filters.hasPhone === true) {
            where.AND = [{ normalizedPhone: { not: null } }, { normalizedPhone: { not: "" } }];
        }
        else if (filters.hasPhone === false) {
            where.OR = [{ normalizedPhone: null }, { normalizedPhone: "" }];
        }
        try {
            return await this.readTransaction(async (tx) => {
                const total = await tx.customer.count({ where });
                const customers = await tx.customer.findMany({
                    where, select: customerSelect(ordersWhere),
                    orderBy: [{ name: { sort: "asc", nulls: "last" } }, { id: "asc" }],
                    skip: (filters.page - 1) * filters.limit, take: filters.limit,
                });
                return {
                    data: customers.map(toCustomerResult),
                    pagination: {
                        page: filters.page, limit: filters.limit,
                        total, totalPages: Math.ceil(total / filters.limit),
                    },
                };
            });
        }
        catch {
            throw new AppError_1.AppError("Não foi possível consultar os clientes", 503);
        }
    }
    async get(userId, customerId) {
        userId = zod_1.z.string().trim().min(1).parse(userId);
        customerId = customerSchemas_1.customerIdSchema.parse(customerId);
        const ordersWhere = orderFilter(userId);
        let row;
        try {
            row = await this.readTransaction((tx) => tx.customer.findFirst({
                where: { id: customerId, orders: { some: ordersWhere } },
                select: customerSelect(ordersWhere),
            }));
        }
        catch {
            throw new AppError_1.AppError("Não foi possível consultar o cliente", 503);
        }
        if (!row)
            throw new AppError_1.AppError("Cliente não encontrado", 404);
        return toCustomerResult(row);
    }
}
exports.CustomerQueryService = CustomerQueryService;
//# sourceMappingURL=CustomerQueryService.js.map