"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerExtractionService = void 0;
const normalizePhone_1 = require("../../utils/normalizePhone");
const normalizeDocument_1 = require("../../utils/normalizeDocument");
const NFeParserService_1 = require("../invoices/NFeParserService");
function normalizeName(value) {
    return value?.trim().replace(/\s+/g, " ") || null;
}
/** Combina dados do pedido/envio e da NF-e, sem persistência. */
class CustomerExtractionService {
    nfeParser;
    constructor(nfeParser = new NFeParserService_1.NFeParserService()) {
        this.nfeParser = nfeParser;
    }
    async extract(sources) {
        const recipient = await sources.getRecipient();
        const customer = {
            name: normalizeName(recipient.name),
            phone: (0, normalizePhone_1.normalizePhone)(recipient.phone),
            ...(0, normalizeDocument_1.normalizeCustomerDocument)(recipient.document, recipient.documentType),
        };
        if (customer.phone !== null && customer.document !== null)
            return customer;
        const xml = await sources.getInvoiceXml();
        if (xml === null)
            return customer;
        const invoice = this.nfeParser.parse(xml);
        const invoiceDocument = (0, normalizeDocument_1.normalizeCustomerDocument)(invoice.document, invoice.documentType);
        return {
            name: customer.name ?? normalizeName(invoice.customerName),
            phone: customer.phone ?? (0, normalizePhone_1.normalizePhone)(invoice.phone),
            ...(customer.document !== null ? {
                document: customer.document, documentType: customer.documentType,
            } : invoiceDocument),
        };
    }
}
exports.CustomerExtractionService = CustomerExtractionService;
//# sourceMappingURL=CustomerExtractionService.js.map