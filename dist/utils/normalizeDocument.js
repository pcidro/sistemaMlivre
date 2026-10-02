"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDocument = normalizeDocument;
exports.normalizeCustomerDocument = normalizeCustomerDocument;
/** Validação estrutural; não verifica os dígitos verificadores. */
function normalizeDocument(value) {
    if (!value || !/^[\d\s./-]+$/.test(value))
        return null;
    const digits = value.replace(/\D/g, "");
    return digits.length === 11 || digits.length === 14 ? digits : null;
}
function normalizeCustomerDocument(value, declaredType) {
    const document = normalizeDocument(value);
    const documentType = document === null ? null : document.length === 11 ? "CPF" : "CNPJ";
    if (declaredType && declaredType !== documentType) {
        return { document: null, documentType: null };
    }
    return { document, documentType };
}
//# sourceMappingURL=normalizeDocument.js.map