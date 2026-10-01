"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const normalizePhone_1 = require("./normalizePhone");
(0, node_test_1.test)("normaliza telefone celular brasileiro formatado", () => {
    strict_1.default.equal((0, normalizePhone_1.normalizePhone)("(11) 99999-9999"), "5511999999999");
});
(0, node_test_1.test)("adiciona o código do Brasil ao número com DDD", () => {
    strict_1.default.equal((0, normalizePhone_1.normalizePhone)("11999999999"), "5511999999999");
});
(0, node_test_1.test)("preserva um número que já possui o código do Brasil", () => {
    strict_1.default.equal((0, normalizePhone_1.normalizePhone)("+55 11 99999-9999"), "5511999999999");
    strict_1.default.equal((0, normalizePhone_1.normalizePhone)("0055 11 99999-9999"), "5511999999999");
});
(0, node_test_1.test)("remove o zero de longa distância antes do DDD", () => {
    strict_1.default.equal((0, normalizePhone_1.normalizePhone)("011 99999-9999"), "5511999999999");
});
(0, node_test_1.test)("normaliza telefone fixo brasileiro", () => {
    strict_1.default.equal((0, normalizePhone_1.normalizePhone)("(11) 3333-4444"), "551133334444");
});
(0, node_test_1.test)("não inventa telefone quando o valor está ausente ou incompleto", () => {
    strict_1.default.equal((0, normalizePhone_1.normalizePhone)(null), null);
    strict_1.default.equal((0, normalizePhone_1.normalizePhone)(undefined), null);
    strict_1.default.equal((0, normalizePhone_1.normalizePhone)(""), null);
    strict_1.default.equal((0, normalizePhone_1.normalizePhone)("9999-9999"), null);
    strict_1.default.equal((0, normalizePhone_1.normalizePhone)("sem telefone"), null);
});
//# sourceMappingURL=normalizePhone.test.js.map