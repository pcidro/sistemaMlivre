"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const mercadoLivreRecipientService_1 = require("./mercadoLivreRecipientService");
const order = {
    externalOrderId: "2000003508419013",
    platform: "MERCADO_LIVRE",
    orderDate: new Date("2026-09-15T12:00:00.000Z"),
    status: "paid",
    customer: { name: null, phone: null },
    items: [],
};
const tokenService = {
    async getValidAccessToken() {
        return "access-token";
    },
    async refreshAccessToken() {
        return "refreshed-access-token";
    },
};
(0, node_test_1.test)("prioriza nome e telefone do destinatário do envio", async () => {
    const requestedUrls = [];
    const mockFetch = (async (input, init) => {
        const url = String(input);
        requestedUrls.push(url);
        if (url.includes("/orders/")) {
            return new Response(JSON.stringify({
                buyer: {
                    first_name: "Maria",
                    last_name: "Compradora",
                    phone: { area_code: "11", number: "3333-4444" },
                },
                shipping: { id: 46803546483 },
            }), { status: 200 });
        }
        const headers = new Headers(init?.headers);
        strict_1.default.equal(headers.get("X-Api-Version"), "2");
        strict_1.default.equal(headers.get("x-format-new"), "true");
        return new Response(JSON.stringify({
            destination: {
                receiver_name: "  Maria   da Silva  ",
                receiver_phone: "+55 (11) 99999-9999",
            },
        }), { status: 200 });
    });
    const service = new mercadoLivreRecipientService_1.MercadoLivreRecipientService({
        tokenService,
        fetchFn: mockFetch,
    });
    strict_1.default.deepEqual(await service.getRecipient("account-id", order), {
        name: "Maria da Silva",
        phone: "5511999999999",
    });
    strict_1.default.equal(requestedUrls.length, 2);
    strict_1.default.match(requestedUrls[1] ?? "", /views=destination/);
});
(0, node_test_1.test)("localiza explicitamente o envio forward quando o pedido não traz shipping.id", async () => {
    const requestedShipmentIds = [];
    const mockFetch = (async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith(`/orders/${order.externalOrderId}`)) {
            return new Response(JSON.stringify({
                buyer: { first_name: "João", last_name: "Santos" },
                shipping: null,
            }), { status: 200 });
        }
        if (url.pathname.endsWith("/shipments")) {
            strict_1.default.equal(url.searchParams.get("hosted"), "true");
            return new Response(JSON.stringify([
                { id: 999, type: "return" },
                { id: 123, type: "forward" },
            ]), { status: 200 });
        }
        requestedShipmentIds.push(url.pathname);
        return new Response(JSON.stringify({
            receiver_address: {
                receiver_name: null,
                receiver_phone: "11987654321",
            },
        }), { status: 200 });
    });
    const service = new mercadoLivreRecipientService_1.MercadoLivreRecipientService({
        tokenService,
        fetchFn: mockFetch,
    });
    strict_1.default.deepEqual(await service.getRecipient("account-id", order), {
        name: "João Santos",
        phone: "5511987654321",
    });
    strict_1.default.deepEqual(requestedShipmentIds, ["/shipments/123"]);
});
(0, node_test_1.test)("retorna null para telefone ausente sem inventar informação", async () => {
    let requests = 0;
    const mockFetch = (async () => {
        requests += 1;
        if (requests === 1) {
            return new Response(JSON.stringify({
                buyer: {},
                shipping: null,
            }), { status: 200 });
        }
        return new Response(null, { status: 204 });
    });
    const service = new mercadoLivreRecipientService_1.MercadoLivreRecipientService({
        tokenService,
        fetchFn: mockFetch,
    });
    strict_1.default.deepEqual(await service.getRecipient("account-id", order), {
        name: null,
        phone: null,
    });
});
//# sourceMappingURL=mercadoLivreRecipientService.test.js.map