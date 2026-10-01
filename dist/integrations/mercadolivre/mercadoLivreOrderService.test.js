"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const AppError_1 = require("../../errors/AppError");
const mercadoLivreOrderService_1 = require("./mercadoLivreOrderService");
const MARKETPLACE_ACCOUNT_ID = "marketplace-account-id";
const USER_ID = "user-id";
const NOW = new Date("2026-10-01T12:00:00.000Z");
const tokenService = {
    async getValidAccessToken() {
        return "access-token";
    },
    async refreshAccessToken() {
        return "refreshed-access-token";
    },
};
const findOwnedAccount = async () => ({
    id: MARKETPLACE_ACCOUNT_ID,
    externalAccountId: "123456789",
});
async function collectOrders(service, dateFrom = new Date("2026-09-01T00:00:00.000Z"), dateTo = new Date("2026-09-30T23:59:59.999Z")) {
    const orders = [];
    for await (const batch of service.getOrders({
        marketplaceAccountId: MARKETPLACE_ACCOUNT_ID,
        userId: USER_ID,
        dateFrom,
        dateTo,
    })) {
        orders.push(...batch);
    }
    return orders;
}
(0, node_test_1.test)("pagina e normaliza pedidos e produtos sem acumular páginas", async () => {
    const requestedOffsets = [];
    const mockFetch = (async (input) => {
        const url = new URL(String(input));
        const offset = url.searchParams.get("offset") ?? "";
        requestedOffsets.push(offset);
        const results = offset === "0"
            ? [
                {
                    id: 1001,
                    status: "paid",
                    date_created: "2026-09-10T10:30:00.000-03:00",
                    order_items: [
                        {
                            item: { id: "MLB123", title: "Produto X" },
                            quantity: 2,
                            unit_price: 19.9,
                        },
                    ],
                },
                {
                    id: 1002,
                    status: null,
                    date_created: "2026-09-11T11:00:00.000-03:00",
                    order_items: [],
                },
            ]
            : [
                {
                    id: "1003",
                    status: "confirmed",
                    date_created: "2026-09-12T12:00:00.000-03:00",
                    order_items: null,
                },
            ];
        return new Response(JSON.stringify({
            paging: { total: 3, offset: Number(offset), limit: 2 },
            results,
        }), { status: 200 });
    });
    const service = new mercadoLivreOrderService_1.MercadoLivreOrderService({
        tokenService,
        fetchFn: mockFetch,
        findOwnedAccount,
        nowFn: () => NOW,
    });
    const orders = await collectOrders(service);
    strict_1.default.deepEqual(requestedOffsets, ["0", "2"]);
    strict_1.default.equal(orders.length, 3);
    strict_1.default.deepEqual(orders[0]?.items, [
        {
            externalProductId: "MLB123",
            productName: "Produto X",
            quantity: 2,
            unitPrice: "19.9",
        },
    ]);
    strict_1.default.deepEqual(orders[1]?.items, []);
    strict_1.default.deepEqual(orders[2]?.items, []);
});
(0, node_test_1.test)("recusa conta que não pertence ao usuário", async () => {
    let tokenWasRequested = false;
    const service = new mercadoLivreOrderService_1.MercadoLivreOrderService({
        tokenService: {
            async getValidAccessToken() {
                tokenWasRequested = true;
                return "access-token";
            },
            async refreshAccessToken() {
                return "access-token";
            },
        },
        findOwnedAccount: async () => null,
        nowFn: () => NOW,
    });
    await strict_1.default.rejects(() => collectOrders(service), AppError_1.AppError);
    strict_1.default.equal(tokenWasRequested, false);
});
(0, node_test_1.test)("respeita Retry-After após rate limit e tenta novamente", async () => {
    let requests = 0;
    const delays = [];
    const mockFetch = (async () => {
        requests += 1;
        if (requests === 1) {
            return new Response(null, {
                status: 429,
                headers: { "Retry-After": "2" },
            });
        }
        return new Response(JSON.stringify({
            paging: { total: 0, offset: 0, limit: 50 },
            results: [],
        }), { status: 200 });
    });
    const service = new mercadoLivreOrderService_1.MercadoLivreOrderService({
        tokenService,
        fetchFn: mockFetch,
        findOwnedAccount,
        sleepFn: async (milliseconds) => {
            delays.push(milliseconds);
        },
        randomFn: () => 0,
        nowFn: () => NOW,
    });
    strict_1.default.deepEqual(await collectOrders(service), []);
    strict_1.default.equal(requests, 2);
    strict_1.default.deepEqual(delays, [2000]);
});
(0, node_test_1.test)("falha de forma controlada quando a API permanece indisponível", async () => {
    let requests = 0;
    const service = new mercadoLivreOrderService_1.MercadoLivreOrderService({
        tokenService,
        fetchFn: (async () => {
            requests += 1;
            return new Response(null, { status: 503 });
        }),
        findOwnedAccount,
        sleepFn: async () => undefined,
        randomFn: () => 0,
        nowFn: () => NOW,
    });
    await strict_1.default.rejects(() => collectOrders(service), (error) => error instanceof AppError_1.AppError && error.statusCode === 503);
    strict_1.default.equal(requests, 5);
});
(0, node_test_1.test)("divide períodos extensos em janelas sequenciais", async () => {
    const windows = [];
    const mockFetch = (async (input) => {
        const url = new URL(String(input));
        windows.push({
            from: url.searchParams.get("order.date_created.from") ?? "",
            to: url.searchParams.get("order.date_created.to") ?? "",
        });
        return new Response(JSON.stringify({
            paging: { total: 0, offset: 0, limit: 50 },
            results: [],
        }), { status: 200 });
    });
    const service = new mercadoLivreOrderService_1.MercadoLivreOrderService({
        tokenService,
        fetchFn: mockFetch,
        findOwnedAccount,
        nowFn: () => NOW,
    });
    await collectOrders(service, new Date("2026-08-01T00:00:00.000Z"), new Date("2026-09-30T23:59:59.999Z"));
    strict_1.default.equal(windows.length, 2);
    strict_1.default.equal(windows[0]?.from, "2026-08-01T00:00:00.000Z");
    strict_1.default.equal(windows[0]?.to, "2026-08-31T23:00:00.000Z");
    strict_1.default.equal(windows[1]?.from, "2026-09-01T00:00:00.000Z");
});
//# sourceMappingURL=mercadoLivreOrderService.test.js.map