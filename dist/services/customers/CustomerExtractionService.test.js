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
const mercadoLivreInvoiceService_1 = require("../../integrations/mercadolivre/mercadoLivreInvoiceService");
const mercadoLivreRecipientService_1 = require("../../integrations/mercadolivre/mercadoLivreRecipientService");
const NFeParserService_1 = require("../invoices/NFeParserService");
const CustomerExtractionService_1 = require("./CustomerExtractionService");
const withPhone = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, "../invoices/fixtures/nfe-with-phone.xml"), "utf8");
const withoutPhone = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, "../invoices/fixtures/nfe-without-phone.xml"), "utf8");
const prefixed = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, "../invoices/fixtures/nfe-prefixed.xml"), "utf8");
function invoiceXml(name, phone) {
    return withPhone
        .replace("<xNome>Maria Fictícia &amp; Família</xNome>", name === null ? "" : `<xNome>${name}</xNome>`)
        .replace("<fone>11999990000</fone>", phone === null ? "" : `<fone>${phone}</fone>`);
}
const combinations = [
    {
        description: "preenche telefone pela NF-e e preserva nome válido do pedido",
        recipient: { name: "Maria Silva", phone: null },
        xml: invoiceXml("Maria Silva", "11999999999"),
        expected: { name: "Maria Silva", phone: "5511999999999" },
    },
    {
        description: "nome divergente da NF-e não substitui nome válido do pedido",
        recipient: { name: "Maria Silva", phone: null },
        xml: invoiceXml("Outro Nome Fictício", "11999999999"),
        expected: { name: "Maria Silva", phone: "5511999999999" },
    },
    {
        description: "obtém nome e telefone pela NF-e quando ausentes no pedido",
        recipient: { name: null, phone: null },
        xml: invoiceXml("Maria Silva", "11999999999"),
        expected: { name: "Maria Silva", phone: "5511999999999" },
    },
    {
        description: "nome ausente na NF-e não apaga nome válido do pedido",
        recipient: { name: "Maria Silva", phone: null },
        xml: invoiceXml(null, "11999999999"),
        expected: { name: "Maria Silva", phone: "5511999999999" },
    },
    {
        description: "mantém telefone null quando nenhuma fonte informa telefone",
        recipient: { name: "Maria Silva", phone: null },
        xml: withoutPhone,
        expected: { name: "Maria Silva", phone: null },
    },
    {
        description: "usa nome da NF-e mesmo quando ambas as fontes não têm telefone",
        recipient: { name: null, phone: null },
        xml: withoutPhone,
        expected: { name: "João Fictício", phone: null },
    },
    {
        description: "NF-e ausente preserva nome e telefone null do pedido",
        recipient: { name: "Maria Silva", phone: null },
        xml: null,
        expected: { name: "Maria Silva", phone: null },
    },
    {
        description: "ambas as fontes vazias resultam em nome e telefone null",
        recipient: { name: null, phone: null },
        xml: invoiceXml(null, null),
        expected: { name: null, phone: null },
    },
    {
        description: "sem destinatário disponível e sem NF-e retorna os campos null",
        recipient: { name: null, phone: null },
        xml: null,
        expected: { name: null, phone: null },
    },
    {
        description: "telefone incompleto no pedido permite consultar a NF-e",
        recipient: { name: "Maria Silva", phone: "9999-9999" },
        xml: invoiceXml("Maria Silva", "11999999999"),
        expected: { name: "Maria Silva", phone: "5511999999999" },
    },
    {
        description: "telefone inválido na NF-e retorna null e preserva nome do pedido",
        recipient: { name: "Maria Silva", phone: null },
        xml: invoiceXml("Outro Nome", "9999-9999"),
        expected: { name: "Maria Silva", phone: null },
    },
    {
        description: "nome e telefone em branco no pedido permitem completar pela NF-e",
        recipient: { name: "   ", phone: "   " },
        xml: invoiceXml("Maria Silva", "11999999999"),
        expected: { name: "Maria Silva", phone: "5511999999999" },
    },
    {
        description: "telefone vazio na NF-e não impede extrair nome",
        recipient: { name: null, phone: "" },
        xml: invoiceXml("Maria Silva", ""),
        expected: { name: "Maria Silva", phone: null },
    },
    {
        description: "normaliza nome e telefone formatado extraídos pela NF-e",
        recipient: { name: null, phone: null },
        xml: invoiceXml("  Maria   Silva  ", "(11) 99999-9999"),
        expected: { name: "Maria Silva", phone: "5511999999999" },
    },
    {
        description: "não adiciona o código do país duas vezes no telefone da NF-e",
        recipient: { name: "Maria Silva", phone: null },
        xml: invoiceXml(null, "5511999999999"),
        expected: { name: "Maria Silva", phone: "5511999999999" },
    },
    {
        description: "aceita fallback de NF-e com namespace prefixado",
        recipient: { name: null, phone: null },
        xml: prefixed,
        expected: { name: "Ana Fictícia", phone: "5521999990000" },
    },
];
for (const { description, recipient, xml, expected } of combinations) {
    (0, node_test_1.test)(description, async () => {
        const calls = [];
        const service = new CustomerExtractionService_1.CustomerExtractionService();
        const original = { ...recipient };
        const result = await service.extract({
            getRecipient: async () => { calls.push("recipient"); return recipient; },
            getInvoiceXml: async () => { calls.push("invoice"); return xml; },
        });
        strict_1.default.deepEqual(result, { ...expected,
            document: xml?.includes("<CPF>00000000000</CPF>") ? "00000000000" : null,
            documentType: xml?.includes("<CPF>00000000000</CPF>") ? "CPF" : null,
        });
        strict_1.default.deepEqual(calls, ["recipient", "invoice"]);
        strict_1.default.deepEqual(recipient, original);
        strict_1.default.deepEqual(Object.keys(result).sort(), ["document", "documentType", "name", "phone"]);
    });
}
(0, node_test_1.test)("telefone e documento válidos do pedido/envio evitam consulta e parsing da NF-e", async () => {
    for (const phone of ["(11) 99999-9999", "11999999999", "+55 11 99999-9999", "5511999999999"]) {
        const service = new CustomerExtractionService_1.CustomerExtractionService({
            parse() { strict_1.default.fail("não deve processar XML"); },
        });
        strict_1.default.deepEqual(await service.extract({
            getRecipient: async () => ({ name: "  Maria   Silva  ", phone, document: "123.456.789-00" }),
            getInvoiceXml: async () => { strict_1.default.fail("não deve consultar NF-e"); },
        }), { name: "Maria Silva", phone: "5511999999999", document: "12345678900", documentType: "CPF" });
    }
});
(0, node_test_1.test)("telefone e documento válidos com nome ausente não disparam consulta de NF-e", async () => {
    const service = new CustomerExtractionService_1.CustomerExtractionService();
    strict_1.default.deepEqual(await service.extract({
        getRecipient: async () => ({ name: null, phone: "11999999999", document: "12345678900" }),
        getInvoiceXml: async () => { strict_1.default.fail("não deve consultar NF-e"); },
    }), { name: null, phone: "5511999999999", document: "12345678900", documentType: "CPF" });
});
(0, node_test_1.test)("XML indisponível não chama parser", async () => {
    const service = new CustomerExtractionService_1.CustomerExtractionService({
        parse() { strict_1.default.fail("não deve processar XML ausente"); },
    });
    strict_1.default.deepEqual(await service.extract({
        getRecipient: async () => ({ name: "Maria Silva", phone: null }),
        getInvoiceXml: async () => null,
    }), { name: "Maria Silva", phone: null, document: null, documentType: null });
});
(0, node_test_1.test)("XML inválido mantém erro explícito para tratamento por pedido", async () => {
    const service = new CustomerExtractionService_1.CustomerExtractionService();
    await strict_1.default.rejects(service.extract({
        getRecipient: async () => ({ name: "Maria Silva", phone: null }),
        getInvoiceXml: async () => "<NFe><infNFe></NFe>",
    }), NFeParserService_1.NFeParserError);
});
(0, node_test_1.test)("falha de consulta de NF-e não é confundida com telefone ausente", async () => {
    const service = new CustomerExtractionService_1.CustomerExtractionService();
    const error = new AppError_1.AppError("API de notas indisponível", 503);
    await strict_1.default.rejects(service.extract({
        getRecipient: async () => ({ name: "Maria Silva", phone: null }),
        getInvoiceXml: async () => { throw error; },
    }), (actual) => actual === error);
});
(0, node_test_1.test)("falha na primeira fonte não inicia consulta de NF-e", async () => {
    const service = new CustomerExtractionService_1.CustomerExtractionService();
    const error = new AppError_1.AppError("API de pedidos indisponível", 503);
    await strict_1.default.rejects(service.extract({
        getRecipient: async () => { throw error; },
        getInvoiceXml: async () => { strict_1.default.fail("não deve consultar NF-e"); },
    }), (actual) => actual === error);
});
(0, node_test_1.test)("combina os serviços existentes de pedido/envio e NF-e com API simulada", async () => {
    const marketplaceAccountId = "account-id";
    const userId = "user-id";
    const order = {
        externalOrderId: "2000003508419013",
        platform: "MERCADO_LIVRE",
        orderDate: null,
        status: "paid",
        customer: { name: null, phone: null },
        items: [],
    };
    const calls = [];
    const tokenService = {
        async getValidAccessToken() { return "fake-token"; },
        async refreshAccessToken() { return "fake-refreshed-token"; },
    };
    const fetchFn = async (input) => {
        const path = new URL(String(input)).pathname;
        calls.push(path);
        let payload;
        if (path === `/orders/${order.externalOrderId}`) {
            payload = {
                buyer: { first_name: "Maria", last_name: "Compradora" },
                shipping: { id: "123" },
            };
        }
        else if (path === "/shipments/123/billing_info") {
            return new Response(null, { status: 404 });
        }
        else if (path === "/shipments/123") {
            payload = { destination: { receiver_name: "Maria Silva", receiver_phone: null } };
        }
        else if (path === `/users/456/invoices/orders/${order.externalOrderId}`) {
            payload = {
                status: "authorized",
                attributes: { xml_location: "/users/456/invoices/documents/xml/789/authorized" },
                fiscal_data: { transaction_type: "sale" },
            };
        }
        else if (path === "/users/456/invoices/documents/xml/789/authorized") {
            return new Response(invoiceXml("Outro Nome", "11999999999"), {
                headers: { "content-type": "application/xml" },
            });
        }
        else {
            strict_1.default.fail(`requisição inesperada: ${path}`);
        }
        return new Response(JSON.stringify(payload), {
            headers: { "content-type": "application/json" },
        });
    };
    const recipientService = new mercadoLivreRecipientService_1.MercadoLivreRecipientService({ tokenService, fetchFn });
    const invoiceService = new mercadoLivreInvoiceService_1.MercadoLivreInvoiceService({
        tokenService,
        fetchFn,
        findOwnedAccount: async (accountId, ownerId) => {
            strict_1.default.equal(accountId, marketplaceAccountId);
            strict_1.default.equal(ownerId, userId);
            return { externalAccountId: "456" };
        },
    });
    const customer = await new CustomerExtractionService_1.CustomerExtractionService().extract({
        getRecipient: () => recipientService.getRecipient(marketplaceAccountId, order),
        getInvoiceXml: () => invoiceService.getInvoiceXml({
            marketplaceAccountId,
            userId,
            externalOrderId: order.externalOrderId,
        }),
    });
    strict_1.default.deepEqual(customer, { name: "Maria Silva", phone: "5511999999999", document: "00000000000", documentType: "CPF" });
    strict_1.default.deepEqual(calls, [
        `/orders/${order.externalOrderId}`,
        "/shipments/123/billing_info",
        "/shipments/123",
        `/users/456/invoices/orders/${order.externalOrderId}`,
        "/users/456/invoices/documents/xml/789/authorized",
    ]);
});
(0, node_test_1.test)("telefone disponível e documento ausente ainda consultam NF-e e preservam nome e telefone", async () => {
    const result = await new CustomerExtractionService_1.CustomerExtractionService().extract({
        getRecipient: async () => ({ name: "Maria", phone: "11999999999", document: null }),
        getInvoiceXml: async () => withPhone.replace("00000000000</CPF>", "12345678900</CPF>"),
    });
    strict_1.default.deepEqual(result, { name: "Maria", phone: "5511999999999", document: "12345678900", documentType: "CPF" });
});
(0, node_test_1.test)("documento oficial do Mercado Livre tem prioridade sobre documento diferente ou ausente na NF-e", async () => {
    for (const xml of [withPhone, withoutPhone, null]) {
        const result = await new CustomerExtractionService_1.CustomerExtractionService().extract({
            getRecipient: async () => ({ name: "Maria", phone: null, document: "12.345.678/0001-90", documentType: "CNPJ" }),
            getInvoiceXml: async () => xml,
        });
        strict_1.default.equal(result.document, "12345678000190");
        strict_1.default.equal(result.documentType, "CNPJ");
    }
});
(0, node_test_1.test)("documento inválido do Mercado Livre permite fallback e documento ausente mantém null", async () => {
    for (const document of [null, "123", "***.456.789-00"]) {
        const result = await new CustomerExtractionService_1.CustomerExtractionService().extract({
            getRecipient: async () => ({ name: null, phone: null, document }),
            getInvoiceXml: async () => withPhone,
        });
        strict_1.default.equal(result.document, "00000000000");
        strict_1.default.equal(result.documentType, "CPF");
    }
});
//# sourceMappingURL=CustomerExtractionService.test.js.map