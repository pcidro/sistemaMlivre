"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const normalizeDocument_1 = require("./normalizeDocument");
for (const [input, expected] of [
    ["123.456.789-00", "12345678900"], ["12345678900", "12345678900"],
    [" 12.345.678/0001-90 ", "12345678000190"], ["12345678000190", "12345678000190"],
    ["001.234.567-89", "00123456789"], [null, null], [undefined, null], ["", null],
    ["   ", null], ["123", null], ["123456789012", null], ["***.456.789-00", null],
    ["abc12345678900", null], ["AB123456000190", null],
]) {
    (0, node_test_1.test)(`normaliza documento fictício: ${JSON.stringify(input)}`, () => {
        strict_1.default.equal((0, normalizeDocument_1.normalizeDocument)(input), expected);
    });
}
(0, node_test_1.test)("infere tipo e recusa tipo declarado incompatível ou não suportado", () => {
    strict_1.default.deepEqual((0, normalizeDocument_1.normalizeCustomerDocument)("12345678900"), { document: "12345678900", documentType: "CPF" });
    strict_1.default.deepEqual((0, normalizeDocument_1.normalizeCustomerDocument)("12345678000190"), { document: "12345678000190", documentType: "CNPJ" });
    for (const type of ["CNPJ", "RG"]) {
        strict_1.default.deepEqual((0, normalizeDocument_1.normalizeCustomerDocument)("12345678900", type), { document: null, documentType: null });
    }
});
//# sourceMappingURL=normalizeDocument.test.js.map