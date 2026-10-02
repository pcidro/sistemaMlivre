"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
(0, node_test_1.test)("repete 429 respeitando Retry-After e segue a consulta do destinatário", async () => {
    let calls = 0;
    const delays = [];
    const service = new mercadoLivreRecipientService_1.MercadoLivreRecipientService({
        tokenService,
        sleepFn: async (ms) => { delays.push(ms); },
        fetchFn: async () => {
            if (++calls === 1)
                return new Response(null, { status: 429, headers: { "Retry-After": "2" } });
            if (calls === 2)
                return new Response(JSON.stringify({ buyer: { first_name: "Maria" }, shipping: null }));
            return new Response(null, { status: 204 });
        },
    });
    strict_1.default.deepEqual(await service.getRecipient("account-id", order), { name: "Maria", phone: null, document: null, documentType: null });
    strict_1.default.deepEqual(delays, [2000]);
});
(0, node_test_1.test)("429 persistente encerra pedido após tentativas limitadas", async () => {
    let calls = 0;
    const service = new mercadoLivreRecipientService_1.MercadoLivreRecipientService({
        tokenService, sleepFn: async () => { },
        fetchFn: async () => { calls++; return new Response(null, { status: 429 }); },
    });
    await strict_1.default.rejects(service.getRecipient("account-id", order));
    strict_1.default.equal(calls, 3);
});
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
        if (url.endsWith("/billing_info"))
            return new Response(null, { status: 404 });
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
        document: null, documentType: null,
    });
    strict_1.default.equal(requestedUrls.length, 3);
    strict_1.default.match(requestedUrls[2] ?? "", /views=destination/);
});
(0, node_test_1.test)("localiza explicitamente o envio forward quando o pedido não traz shipping.id", async () => {
    const requestedShipmentIds = [];
    const mockFetch = (async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/billing_info"))
            return new Response(null, { status: 404 });
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
        document: null, documentType: null,
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
        document: null, documentType: null,
    });
});
for (const [type, value] of [["CPF", "00123456789"], ["CNPJ", "12345678000190"]]) {
    (0, node_test_1.test)(`obtém ${type} no contrato oficial atual de billing info`, async () => {
        const paths = [];
        const service = new mercadoLivreRecipientService_1.MercadoLivreRecipientService({
            tokenService,
            fetchFn: async (input, init) => {
                const url = new URL(String(input));
                paths.push(url.pathname);
                strict_1.default.equal(new Headers(init?.headers).get("Authorization"), "Bearer access-token");
                if (url.pathname === `/orders/${order.externalOrderId}`) {
                    return new Response(JSON.stringify({ buyer: { billing_info: { id: "billing-id" } }, shipping: null }));
                }
                if (url.pathname === "/orders/billing-info/MLB/billing-id") {
                    return new Response(JSON.stringify({
                        buyer: { billing_info: { identification: { type, number: value } } },
                        seller: { billing_info: { identification: { type: "CNPJ", number: "00000000000100" } } },
                    }));
                }
                strict_1.default.equal(url.pathname, `/orders/${order.externalOrderId}/shipments`);
                return new Response(null, { status: 204 });
            },
        });
        const result = await service.getRecipient("account-id", order);
        strict_1.default.equal(result.document, value);
        strict_1.default.equal(result.documentType, type);
        strict_1.default.deepEqual(paths, [`/orders/${order.externalOrderId}`, "/orders/billing-info/MLB/billing-id", `/orders/${order.externalOrderId}/shipments`]);
    });
}
(0, node_test_1.test)("obtém documento de receiver no billing_info do envio, ignorando sender e carrier", async () => {
    const service = new mercadoLivreRecipientService_1.MercadoLivreRecipientService({
        tokenService,
        fetchFn: async (input) => {
            const path = new URL(String(input)).pathname;
            if (path === `/orders/${order.externalOrderId}`) {
                return new Response(JSON.stringify({ buyer: {}, shipping: { id: "123" } }));
            }
            if (path === "/shipments/123/billing_info") {
                return new Response(JSON.stringify({
                    receiver: { document: { id: "CPF", value: "00123456789" } },
                    senders: [{ document: { id: "CNPJ", value: "00000000000100" } }],
                    carrier: { document: { id: "CNPJ", value: "99999999000100" } },
                }));
            }
            strict_1.default.equal(path, "/shipments/123");
            return new Response(JSON.stringify({ destination: { receiver_name: "Maria", receiver_phone: "11999999999" } }));
        },
    });
    strict_1.default.deepEqual(await service.getRecipient("account-id", order), {
        name: "Maria", phone: "5511999999999", document: "00123456789", documentType: "CPF",
    });
});
(0, node_test_1.test)("documento ausente, mascarado, numérico, RG ou incompatível permite retorno sem documento", async () => {
    for (const identification of [null, { type: "CPF", number: "***.456.789-00" },
        { type: "CPF", number: 12345678900 }, { type: "RG", number: "12345678900" },
        { type: "CNPJ", number: "12345678900" }]) {
        const service = new mercadoLivreRecipientService_1.MercadoLivreRecipientService({
            tokenService,
            fetchFn: async (input) => {
                const path = new URL(String(input)).pathname;
                if (path === `/orders/${order.externalOrderId}`) {
                    return new Response(JSON.stringify({ buyer: { billing_info: { id: "1" } }, shipping: null }));
                }
                if (path === "/orders/billing-info/MLB/1") {
                    return new Response(JSON.stringify({ buyer: { billing_info: { identification } } }));
                }
                return new Response(null, { status: 204 });
            },
        });
        const result = await service.getRecipient("account-id", order);
        strict_1.default.equal(result.document, null);
        strict_1.default.equal(result.documentType, null);
    }
});
(0, node_test_1.test)("dados fiscais indisponíveis ou sem permissão mantêm documento null para fallback da NF-e", async () => {
    for (const status of [403, 404, 204]) {
        const service = new mercadoLivreRecipientService_1.MercadoLivreRecipientService({
            tokenService,
            fetchFn: async (input) => {
                const path = new URL(String(input)).pathname;
                if (path === `/orders/${order.externalOrderId}`) {
                    return new Response(JSON.stringify({ buyer: { billing_info: { id: "1" } }, shipping: { id: "123" } }));
                }
                if (path.includes("billing"))
                    return new Response(null, { status });
                return new Response(JSON.stringify({ destination: { receiver_name: "Maria", receiver_phone: "11999999999" } }));
            },
        });
        const result = await service.getRecipient("account-id", order);
        strict_1.default.equal(result.document, null);
        strict_1.default.equal(result.phone, "5511999999999");
    }
});
(0, node_test_1.test)("dados fiscais seguem as mesmas tentativas limitadas e Retry-After", async () => {
    const delays = [];
    let attempts = 0;
    const service = new mercadoLivreRecipientService_1.MercadoLivreRecipientService({
        tokenService, sleepFn: async (milliseconds) => { delays.push(milliseconds); },
        fetchFn: async (input) => {
            const path = new URL(String(input)).pathname;
            if (path === `/orders/${order.externalOrderId}`) {
                return new Response(JSON.stringify({ buyer: { billing_info: { id: "1" } }, shipping: null }));
            }
            if (path === "/orders/billing-info/MLB/1") {
                if (++attempts === 1)
                    return new Response(null, { status: 429, headers: { "Retry-After": "2" } });
                return new Response(JSON.stringify({ buyer: { billing_info: { identification: { type: "CPF", number: "12345678900" } } } }));
            }
            return new Response(null, { status: 204 });
        },
    });
    strict_1.default.equal((await service.getRecipient("account-id", order)).document, "12345678900");
    strict_1.default.deepEqual(delays, [2000]);
});
//# sourceMappingURL=mercadoLivreRecipientService.test.js.map