"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_test_1 = require("node:test");
const AppError_1 = require("../../errors/AppError");
const NFeParserService_1 = require("../../services/invoices/NFeParserService");
const mercadoLivreInvoiceService_1 = require("./mercadoLivreInvoiceService");
const sellerId = "123456789";
const input = {
    marketplaceAccountId: "account-id",
    userId: "user-id",
    externalOrderId: "2000003508419013",
};
const xmlPath = `/users/${sellerId}/invoices/documents/xml/987654/authorized`;
const metadataUrl = `https://api.mercadolibre.com/users/${sellerId}/invoices/orders/${input.externalOrderId}`;
const xmlWithPhone = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, "../../services/invoices/fixtures/nfe-with-phone.xml"), "utf8");
const xmlWithoutPhone = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, "../../services/invoices/fixtures/nfe-without-phone.xml"), "utf8");
const tokenService = {
    async getValidAccessToken() { return "fake-access-token"; },
    async refreshAccessToken() { return "fake-refreshed-token"; },
};
function invoice(location = xmlPath) {
    return {
        status: "authorized",
        transaction_status: "authorized",
        attributes: { xml_location: location },
        fiscal_data: { transaction_type: "sale" },
    };
}
function json(payload) {
    return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
}
function xmlResponse(xml = xmlWithPhone) {
    return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
function makeService(fetchFn) {
    return new mercadoLivreInvoiceService_1.MercadoLivreInvoiceService({
        tokenService,
        findOwnedAccount: async () => ({ externalAccountId: sellerId }),
        fetchFn,
        sleepFn: async () => { },
    });
}
function statusError(code) {
    return (error) => error instanceof AppError_1.AppError && error.statusCode === code;
}
(0, node_test_1.test)("localiza nota pelo pedido da conta e retorna o XML oficial sem alteração", async () => {
    const calls = [];
    const service = new mercadoLivreInvoiceService_1.MercadoLivreInvoiceService({
        tokenService,
        findOwnedAccount: async (accountId, userId) => {
            strict_1.default.equal(accountId, input.marketplaceAccountId);
            strict_1.default.equal(userId, input.userId);
            return { externalAccountId: sellerId };
        },
        fetchFn: async (url, options) => {
            calls.push(String(url));
            strict_1.default.equal(options?.method, "GET");
            strict_1.default.equal(new Headers(options?.headers).get("Authorization"), "Bearer fake-access-token");
            strict_1.default.equal(options?.redirect, "error");
            strict_1.default.ok(options?.signal instanceof AbortSignal);
            if (calls.length === 1) {
                strict_1.default.equal(new Headers(options?.headers).get("Accept"), "application/json");
                return json(invoice());
            }
            strict_1.default.equal(new Headers(options?.headers).get("Accept"), "application/xml, text/xml");
            return xmlResponse();
        },
    });
    strict_1.default.equal(await service.getInvoiceXml(input), xmlWithPhone);
    strict_1.default.deepEqual(calls, [metadataUrl, `https://api.mercadolibre.com${xmlPath}`]);
});
(0, node_test_1.test)("aceita xml_location absoluto no host oficial", async () => {
    let requests = 0;
    const service = makeService(async () => ++requests === 1
        ? json(invoice(`https://api.mercadolibre.com${xmlPath}`)) : xmlResponse());
    strict_1.default.equal(await service.getInvoiceXml(input), xmlWithPhone);
});
(0, node_test_1.test)("aceita status em maiúsculas e xml_location diretamente na nota", async () => {
    let requests = 0;
    const service = makeService(async () => ++requests === 1
        ? json({ status: "AUTHORIZED", xml_location: xmlPath }) : xmlResponse());
    strict_1.default.equal(await service.getInvoiceXml(input), xmlWithPhone);
});
(0, node_test_1.test)("consulta ausente (404 ou 204) retorna null", async () => {
    for (const status of [404, 204]) {
        const service = makeService(async () => new Response(null, { status }));
        strict_1.default.equal(await service.getInvoiceXml(input), null);
    }
});
(0, node_test_1.test)("XML ainda indisponível (404 ou 204) retorna null", async () => {
    for (const status of [404, 204]) {
        let requests = 0;
        const service = makeService(async () => ++requests === 1
            ? json(invoice()) : new Response(null, { status }));
        strict_1.default.equal(await service.getInvoiceXml(input), null);
    }
});
(0, node_test_1.test)("nota pendente, cancelada ou sem xml_location não tenta baixar XML", async () => {
    for (const payload of [
        { ...invoice(), status: "pending" },
        { ...invoice(), status: "canceled" },
        { ...invoice(), transaction_status: "canceled" },
        invoice(null),
        { status: "authorized" },
        [],
        { ...invoice(), fiscal_data: { transaction_type: "cte" } },
        { ...invoice(), fiscal_data: { transaction_type: "sale_return" } },
    ]) {
        let requests = 0;
        const service = makeService(async () => { requests++; return json(payload); });
        strict_1.default.equal(await service.getInvoiceXml(input), null);
        strict_1.default.equal(requests, 1);
    }
});
(0, node_test_1.test)("lista com vários documentos seleciona NF-e de venda autorizada", async () => {
    let requests = 0;
    const service = makeService(async () => ++requests === 1
        ? json([
            { ...invoice(), fiscal_data: { transaction_type: "symbolic_inbound_return" } },
            { ...invoice(), status: "canceled" },
            invoice(),
        ]) : xmlResponse());
    strict_1.default.equal(await service.getInvoiceXml(input), xmlWithPhone);
    strict_1.default.equal(requests, 2);
});
(0, node_test_1.test)("conta inacessível ou de outro usuário falha antes de obter tokens", async () => {
    const service = new mercadoLivreInvoiceService_1.MercadoLivreInvoiceService({
        findOwnedAccount: async () => null,
        tokenService: {
            async getValidAccessToken() { strict_1.default.fail("não deve consultar tokens"); },
            async refreshAccessToken() { strict_1.default.fail("não deve renovar tokens"); },
        },
        fetchFn: async () => { strict_1.default.fail("não deve consultar API"); },
    });
    await strict_1.default.rejects(service.getInvoiceXml(input), statusError(404));
});
(0, node_test_1.test)("entrada inválida é rejeitada sem consultar conta ou API", async () => {
    const service = new mercadoLivreInvoiceService_1.MercadoLivreInvoiceService({
        findOwnedAccount: async () => { strict_1.default.fail("não deve consultar conta"); },
        tokenService,
        fetchFn: async () => { strict_1.default.fail("não deve consultar API"); },
    });
    for (const value of [
        { ...input, externalOrderId: "../users" },
        { ...input, externalOrderId: "" },
        { ...input, userId: "" },
        { ...input, marketplaceAccountId: "" },
    ])
        await strict_1.default.rejects(service.getInvoiceXml(value), statusError(400));
});
(0, node_test_1.test)("bloqueia URLs externas, outra conta, protocolo inseguro e caminhos de outros documentos", async () => {
    for (const location of [
        `https://example.com${xmlPath}`,
        `//example.com${xmlPath}`,
        `http://api.mercadolibre.com${xmlPath}`,
        `https://api.mercadolibre.com:444${xmlPath}`,
        `https://user:password@api.mercadolibre.com${xmlPath}`,
        "/users/999/invoices/documents/xml/987654/authorized",
        `/users/${sellerId}/invoices/sites/MLB/documents/danfe/987654`,
        `${xmlPath}?redirect=https://example.com`,
        `${xmlPath}#fragment`,
        "file:///private.xml",
    ]) {
        let requests = 0;
        const service = makeService(async () => { requests++; return json(invoice(location)); });
        await strict_1.default.rejects(service.getInvoiceXml(input), statusError(502));
        strict_1.default.equal(requests, 1);
    }
});
(0, node_test_1.test)("401 renova o token da conta uma vez, tanto na consulta quanto no download", async () => {
    for (const expiredStage of ["metadata", "xml"]) {
        let refreshes = 0;
        let expired = false;
        const service = new mercadoLivreInvoiceService_1.MercadoLivreInvoiceService({
            tokenService: {
                ...tokenService,
                async refreshAccessToken(accountId) {
                    strict_1.default.equal(accountId, input.marketplaceAccountId);
                    refreshes++;
                    return "fake-refreshed-token";
                },
            },
            findOwnedAccount: async () => ({ externalAccountId: sellerId }),
            fetchFn: async (url, options) => {
                const stage = String(url) === metadataUrl ? "metadata" : "xml";
                if (stage === expiredStage && !expired) {
                    expired = true;
                    return new Response(null, { status: 401 });
                }
                const expectedToken = expired ? "fake-refreshed-token" : "fake-access-token";
                strict_1.default.equal(new Headers(options?.headers).get("Authorization"), `Bearer ${expectedToken}`);
                return stage === "metadata" ? json(invoice()) : xmlResponse();
            },
        });
        strict_1.default.equal(await service.getInvoiceXml(input), xmlWithPhone);
        strict_1.default.equal(refreshes, 1);
    }
});
(0, node_test_1.test)("401 persistente ou 403 produz erro explícito de autorização", async () => {
    for (const status of [401, 403]) {
        let requests = 0;
        const service = makeService(async () => { requests++; return new Response(null, { status }); });
        await strict_1.default.rejects(service.getInvoiceXml(input), statusError(403));
        strict_1.default.equal(requests, status === 401 ? 2 : 1);
    }
});
(0, node_test_1.test)("falha ao descartar corpo de erro não expõe erro do upstream", async () => {
    const service = makeService(async () => new Response(new ReadableStream({ start(controller) { controller.error(new Error("corpo privado")); } }), { status: 403 }));
    await strict_1.default.rejects(service.getInvoiceXml(input), (error) => {
        strict_1.default.ok(error instanceof AppError_1.AppError);
        strict_1.default.equal(error.statusCode, 403);
        strict_1.default.ok(!error.message.includes("privado"));
        return true;
    });
});
(0, node_test_1.test)("respeita retry-after e limita tentativas em 429", async () => {
    const waits = [];
    let requests = 0;
    const service = new mercadoLivreInvoiceService_1.MercadoLivreInvoiceService({
        tokenService,
        findOwnedAccount: async () => ({ externalAccountId: sellerId }),
        fetchFn: async () => {
            requests++;
            return new Response(null, { status: 429, headers: { "retry-after": "2" } });
        },
        sleepFn: async (milliseconds) => { waits.push(milliseconds); },
    });
    await strict_1.default.rejects(service.getInvoiceXml(input), statusError(429));
    strict_1.default.equal(requests, 3);
    strict_1.default.deepEqual(waits, [2000, 2000]);
});
(0, node_test_1.test)("5xx transitório pode se recuperar na consulta e no download", async () => {
    const requests = new Map();
    const service = makeService(async (url) => {
        const count = (requests.get(String(url)) ?? 0) + 1;
        requests.set(String(url), count);
        if (count === 1)
            return new Response(null, { status: 503 });
        return String(url) === metadataUrl ? json(invoice()) : xmlResponse();
    });
    strict_1.default.equal(await service.getInvoiceXml(input), xmlWithPhone);
    strict_1.default.equal(requests.get(metadataUrl), 2);
    strict_1.default.equal(requests.get(`https://api.mercadolibre.com${xmlPath}`), 2);
});
(0, node_test_1.test)("falha de rede, timeout e 5xx persistente ficam limitados ao pedido consultado", async () => {
    for (const failure of ["network", "timeout", "5xx"]) {
        let requests = 0;
        const service = makeService(async () => {
            requests++;
            if (failure === "network")
                throw new Error("detalhe privado do upstream");
            if (failure === "timeout")
                throw new DOMException("timeout", "TimeoutError");
            return new Response("detalhe privado do upstream", { status: 500 });
        });
        await strict_1.default.rejects(service.getInvoiceXml(input), (error) => {
            strict_1.default.ok(error instanceof AppError_1.AppError);
            strict_1.default.equal(error.statusCode, 503);
            strict_1.default.ok(!error.message.includes("detalhe privado"));
            return true;
        });
        strict_1.default.equal(requests, 3);
    }
});
(0, node_test_1.test)("resposta inválida de metadados não é tratada como nota ausente", async () => {
    for (const response of [json(null), json({ invalid: true }), new Response("not-json")]) {
        await strict_1.default.rejects(makeService(async () => response).getInvoiceXml(input), statusError(502));
    }
});
(0, node_test_1.test)("HTML, PDF e corpo vazio não são aceitos como XML", async () => {
    for (const response of [
        new Response("<html>erro</html>", { headers: { "content-type": "text/html" } }),
        new Response("%PDF", { headers: { "content-type": "application/pdf" } }),
        xmlResponse("   "),
    ]) {
        let requests = 0;
        const service = makeService(async () => ++requests === 1 ? json(invoice()) : response);
        await strict_1.default.rejects(service.getInvoiceXml(input), statusError(502));
    }
});
(0, node_test_1.test)("limita tamanho do XML pelo cabeçalho e pelos bytes efetivamente recebidos", async () => {
    for (const response of [
        new Response("<NFe/>", {
            headers: { "content-type": "application/xml", "content-length": String(NFeParserService_1.MAX_NFE_XML_BYTES + 1) },
        }),
        new Response("x".repeat(NFeParserService_1.MAX_NFE_XML_BYTES + 1), { headers: { "content-type": "application/xml" } }),
    ]) {
        let requests = 0;
        const service = makeService(async () => ++requests === 1 ? json(invoice()) : response);
        await strict_1.default.rejects(service.getInvoiceXml(input), statusError(502));
    }
});
(0, node_test_1.test)("erro durante leitura do XML é seguro e não retorna documento parcial", async () => {
    let requests = 0;
    const service = makeService(async () => ++requests === 1 ? json(invoice()) : new Response(new ReadableStream({ start(controller) { controller.error(new Error("conteúdo sensível")); } }), { headers: { "content-type": "application/xml" } }));
    await strict_1.default.rejects(service.getInvoiceXml(input), (error) => {
        strict_1.default.ok(error instanceof AppError_1.AppError);
        strict_1.default.equal(error.statusCode, 503);
        strict_1.default.ok(!error.message.includes("sensível"));
        return true;
    });
});
(0, node_test_1.test)("parser compartilhado processa XML obtido com e sem telefone", async () => {
    const parser = new NFeParserService_1.NFeParserService();
    const results = [];
    for (const xml of [xmlWithPhone, xmlWithoutPhone]) {
        let requests = 0;
        const service = makeService(async () => ++requests === 1 ? json(invoice()) : xmlResponse(xml));
        const downloaded = await service.getInvoiceXml(input);
        strict_1.default.ok(downloaded);
        results.push(parser.parse(downloaded));
    }
    strict_1.default.equal(results[0]?.phone, "11999990000");
    strict_1.default.equal(results[1]?.phone, null);
    strict_1.default.equal(results[1]?.customerName, "João Fictício");
});
(0, node_test_1.test)("XML malformado baixado é rejeitado pelo parser independente", async () => {
    let requests = 0;
    const service = makeService(async () => ++requests === 1
        ? json(invoice()) : xmlResponse("<NFe><infNFe></NFe>"));
    const downloaded = await service.getInvoiceXml(input);
    strict_1.default.ok(downloaded);
    strict_1.default.throws(() => new NFeParserService_1.NFeParserService().parse(downloaded), NFeParserService_1.NFeParserError);
});
//# sourceMappingURL=mercadoLivreInvoiceService.test.js.map