"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoLivreOrderService = void 0;
exports.normalizeMercadoLivreOrder = normalizeMercadoLivreOrder;
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const prisma_1 = require("../../lib/prisma");
const mercadoLivreTokenService_1 = require("./mercadoLivreTokenService");
const ORDERS_SEARCH_URL = "https://api.mercadolibre.com/orders/search";
const PAGE_SIZE = 50;
const WINDOW_SIZE_HOURS = 31 * 24;
const ORDER_RETENTION_MONTHS = 12;
const MAX_REQUEST_ATTEMPTS = 5;
const MAX_RETRY_DELAY_MILLISECONDS = 30_000;
const externalIdSchema = zod_1.z.union([
    zod_1.z.string().min(1),
    zod_1.z.number().int().positive(),
]);
const orderItemSchema = zod_1.z.object({
    item: zod_1.z
        .object({
        id: externalIdSchema.nullable().optional(),
        title: zod_1.z.string().nullable().optional(),
    })
        .nullable()
        .optional(),
    quantity: zod_1.z.number().int().nonnegative(),
    unit_price: zod_1.z.union([zod_1.z.number().nonnegative(), zod_1.z.string().min(1)]).nullable(),
});
const orderSchema = zod_1.z.object({
    id: externalIdSchema,
    status: zod_1.z.string().nullable().optional(),
    date_created: zod_1.z.string().min(1),
    order_items: zod_1.z.array(orderItemSchema).nullable().optional(),
});
const ordersPageSchema = zod_1.z.object({
    paging: zod_1.z.object({
        total: zod_1.z.number().int().nonnegative(),
        offset: zod_1.z.number().int().nonnegative(),
        limit: zod_1.z.number().int().positive(),
    }),
    results: zod_1.z.array(orderSchema),
});
function normalizeExternalId(value) {
    if (typeof value === "number") {
        if (!Number.isSafeInteger(value)) {
            throw new AppError_1.AppError("O Mercado Livre retornou um identificador de pedido inválido", 502);
        }
        return String(value);
    }
    return value;
}
function normalizeOrderItem(rawItem) {
    const externalProductId = rawItem.item?.id;
    return {
        externalProductId: externalProductId === null || externalProductId === undefined
            ? null
            : normalizeExternalId(externalProductId),
        productName: rawItem.item?.title?.trim() || "Produto não informado",
        quantity: rawItem.quantity,
        unitPrice: rawItem.unit_price === null ? null : String(rawItem.unit_price),
    };
}
function normalizeMercadoLivreOrder(rawOrder) {
    const orderDate = new Date(rawOrder.date_created);
    if (Number.isNaN(orderDate.getTime())) {
        throw new AppError_1.AppError("O Mercado Livre retornou uma data de pedido inválida", 502);
    }
    return {
        externalOrderId: normalizeExternalId(rawOrder.id),
        platform: "MERCADO_LIVRE",
        orderDate,
        status: rawOrder.status ?? null,
        customer: {
            name: null,
            phone: null,
        },
        items: (rawOrder.order_items ?? []).map(normalizeOrderItem),
    };
}
function floorToHour(value) {
    const result = new Date(value);
    result.setUTCMinutes(0, 0, 0);
    return result;
}
function addUtcHours(value, hours) {
    return new Date(value.getTime() + hours * 60 * 60 * 1000);
}
function subtractUtcMonths(value, months) {
    const result = new Date(value);
    result.setUTCMonth(result.getUTCMonth() - months);
    return result;
}
function defaultSleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
class MercadoLivreOrderService {
    tokenService;
    fetchFn;
    findOwnedAccount;
    sleepFn;
    randomFn;
    nowFn;
    constructor(dependencies = {}) {
        this.tokenService =
            dependencies.tokenService ?? new mercadoLivreTokenService_1.MercadoLivreTokenService();
        this.fetchFn = dependencies.fetchFn ?? globalThis.fetch;
        this.findOwnedAccount =
            dependencies.findOwnedAccount ??
                ((marketplaceAccountId, userId) => prisma_1.prisma.marketplaceAccount.findFirst({
                    where: {
                        id: marketplaceAccountId,
                        userId,
                        platform: "MERCADO_LIVRE",
                        isActive: true,
                    },
                    select: {
                        id: true,
                        externalAccountId: true,
                    },
                }));
        this.sleepFn = dependencies.sleepFn ?? defaultSleep;
        this.randomFn = dependencies.randomFn ?? Math.random;
        this.nowFn = dependencies.nowFn ?? (() => new Date());
    }
    async *getOrders(input) {
        this.validatePeriod(input.dateFrom, input.dateTo);
        const account = await this.findOwnedAccount(input.marketplaceAccountId, input.userId);
        if (!account) {
            throw new AppError_1.AppError("Conta do Mercado Livre não encontrada para este usuário", 404);
        }
        const now = this.nowFn();
        const retentionStart = subtractUtcMonths(now, ORDER_RETENTION_MONTHS);
        const effectiveFrom = new Date(Math.max(input.dateFrom.getTime(), retentionStart.getTime()));
        const effectiveTo = new Date(Math.min(input.dateTo.getTime(), now.getTime()));
        if (effectiveFrom > effectiveTo) {
            return;
        }
        let windowStart = floorToHour(effectiveFrom);
        const finalWindowEnd = floorToHour(effectiveTo);
        while (windowStart <= finalWindowEnd) {
            const proposedEnd = addUtcHours(windowStart, WINDOW_SIZE_HOURS - 1);
            const windowEnd = proposedEnd < finalWindowEnd ? proposedEnd : finalWindowEnd;
            yield* this.getWindowOrders(account, windowStart, windowEnd, input.dateFrom, input.dateTo);
            windowStart = addUtcHours(windowEnd, 1);
        }
    }
    async *getWindowOrders(account, windowStart, windowEnd, requestedFrom, requestedTo) {
        let offset = 0;
        const seenOrderIds = new Set();
        while (true) {
            const page = await this.requestPage(account.id, account.externalAccountId, windowStart, windowEnd, offset);
            const orders = page.results
                .map(normalizeMercadoLivreOrder)
                .filter((order) => {
                if (!order.orderDate)
                    return false;
                const isInsideRequestedPeriod = order.orderDate >= requestedFrom && order.orderDate <= requestedTo;
                const isNewOrder = !seenOrderIds.has(order.externalOrderId);
                if (isInsideRequestedPeriod && isNewOrder) {
                    seenOrderIds.add(order.externalOrderId);
                    return true;
                }
                return false;
            });
            if (orders.length > 0) {
                yield orders;
            }
            if (page.results.length === 0) {
                break;
            }
            const nextOffset = offset + page.results.length;
            if (nextOffset >= page.paging.total || nextOffset <= offset) {
                break;
            }
            offset = nextOffset;
        }
    }
    async requestPage(marketplaceAccountId, sellerId, dateFrom, dateTo, offset) {
        let accessToken = await this.tokenService.getValidAccessToken(marketplaceAccountId);
        let refreshedAfterUnauthorized = false;
        for (let attempt = 0; attempt < MAX_REQUEST_ATTEMPTS; attempt += 1) {
            const url = new URL(ORDERS_SEARCH_URL);
            url.searchParams.set("seller", sellerId);
            url.searchParams.set("order.date_created.from", dateFrom.toISOString());
            url.searchParams.set("order.date_created.to", dateTo.toISOString());
            url.searchParams.set("sort", "date_asc");
            url.searchParams.set("offset", String(offset));
            url.searchParams.set("limit", String(PAGE_SIZE));
            let response;
            try {
                response = await this.fetchFn(url, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
            }
            catch {
                if (attempt === MAX_REQUEST_ATTEMPTS - 1) {
                    throw new AppError_1.AppError("A API de pedidos do Mercado Livre está indisponível", 503);
                }
                await this.waitBeforeRetry(attempt);
                continue;
            }
            if (response.status === 401 && !refreshedAfterUnauthorized) {
                accessToken =
                    await this.tokenService.refreshAccessToken(marketplaceAccountId);
                refreshedAfterUnauthorized = true;
                continue;
            }
            if (response.status === 429) {
                if (attempt === MAX_REQUEST_ATTEMPTS - 1) {
                    throw new AppError_1.AppError("Limite de requisições do Mercado Livre excedido. Tente novamente mais tarde", 429);
                }
                await this.waitBeforeRetry(attempt, response.headers.get("retry-after"));
                continue;
            }
            if (response.status >= 500) {
                if (attempt === MAX_REQUEST_ATTEMPTS - 1) {
                    throw new AppError_1.AppError("A API de pedidos do Mercado Livre está indisponível", 503);
                }
                await this.waitBeforeRetry(attempt);
                continue;
            }
            if (!response.ok) {
                throw new AppError_1.AppError("Não foi possível consultar os pedidos do Mercado Livre", 502);
            }
            try {
                return ordersPageSchema.parse(await response.json());
            }
            catch {
                throw new AppError_1.AppError("O Mercado Livre retornou uma lista de pedidos inválida", 502);
            }
        }
        throw new AppError_1.AppError("A API de pedidos do Mercado Livre está indisponível", 503);
    }
    async waitBeforeRetry(attempt, retryAfter = null) {
        const exponentialDelay = 500 * 2 ** attempt;
        const jitter = Math.floor(this.randomFn() * 250);
        const retryAfterDelay = this.parseRetryAfter(retryAfter);
        const delay = Math.min(Math.max(exponentialDelay + jitter, retryAfterDelay), MAX_RETRY_DELAY_MILLISECONDS);
        await this.sleepFn(delay);
    }
    parseRetryAfter(value) {
        if (!value)
            return 0;
        const seconds = Number(value);
        if (Number.isFinite(seconds) && seconds >= 0) {
            return seconds * 1000;
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime()))
            return 0;
        return Math.max(0, date.getTime() - this.nowFn().getTime());
    }
    validatePeriod(dateFrom, dateTo) {
        if (Number.isNaN(dateFrom.getTime()) ||
            Number.isNaN(dateTo.getTime()) ||
            dateFrom > dateTo) {
            throw new AppError_1.AppError("Período de consulta de pedidos inválido", 400);
        }
    }
}
exports.MercadoLivreOrderService = MercadoLivreOrderService;
//# sourceMappingURL=mercadoLivreOrderService.js.map