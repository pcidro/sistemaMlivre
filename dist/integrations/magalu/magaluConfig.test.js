"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const AppError_1 = require("../../errors/AppError");
const magaluConfig_1 = require("./magaluConfig");
(0, node_test_1.test)("ambiente ausente usa sandbox sem precisar de credenciais", () => {
    strict_1.default.deepEqual((0, magaluConfig_1.getMagaluConfig)({}), {
        environment: "sandbox",
        apiBaseUrl: "https://api-sandbox.magalu.com",
        channelId: "5f62650a-0039-4d65-9b96-266d498c03bd",
    });
});
(0, node_test_1.test)("production seleciona host e channel oficiais de produção", () => {
    strict_1.default.deepEqual((0, magaluConfig_1.getMagaluConfig)({ MAGALU_ENV: "production" }), {
        environment: "production",
        apiBaseUrl: "https://api.magalu.com",
        channelId: "9fe0d853-732b-4e4a-a0b0-cff988ed043d",
    });
});
(0, node_test_1.test)("aceita a URL legada correspondente, vazia ou com barra final", () => {
    for (const environment of ["sandbox", "production"]) {
        const expected = (0, magaluConfig_1.getMagaluConfig)({ MAGALU_ENV: environment });
        for (const url of [undefined, "", "  ", expected.apiBaseUrl, `${expected.apiBaseUrl}/`]) {
            strict_1.default.deepEqual((0, magaluConfig_1.getMagaluConfig)({ MAGALU_ENV: environment, MAGALU_API_URL: url }), expected);
        }
    }
});
(0, node_test_1.test)("erro de ambiente não assume silenciosamente produção", () => {
    for (const environment of ["", "prod", "development", "SANDBOX"]) {
        strict_1.default.throws(() => (0, magaluConfig_1.getMagaluConfig)({ MAGALU_ENV: environment }), (error) => error instanceof AppError_1.AppError && error.statusCode === 500);
    }
});
(0, node_test_1.test)("não permite misturar host e ambiente, inclusive sem MAGALU_ENV explícito", () => {
    for (const env of [
        { MAGALU_ENV: "sandbox", MAGALU_API_URL: "https://api.magalu.com" },
        { MAGALU_ENV: "production", MAGALU_API_URL: "https://api-sandbox.magalu.com" },
        { MAGALU_API_URL: "https://api.magalu.com" },
    ]) {
        strict_1.default.throws(() => (0, magaluConfig_1.getMagaluConfig)(env), /MAGALU_API_URL deve corresponder/);
    }
});
(0, node_test_1.test)("recusa HTTP, destinos externos, credenciais, caminhos, query e fragmentos", () => {
    for (const url of [
        "http://api-sandbox.magalu.com", "https://example.com",
        "https://api-sandbox.magalu.com.example.com", "https://api-sandbox.magalu.com:8443",
        "https://segredo-ficticio@api-sandbox.magalu.com",
        "https://api-sandbox.magalu.com/v1", "https://api-sandbox.magalu.com?token=segredo-ficticio",
        "https://api-sandbox.magalu.com#segredo-ficticio", "segredo-ficticio",
    ]) {
        strict_1.default.throws(() => (0, magaluConfig_1.getMagaluConfig)({ MAGALU_API_URL: url }), (error) => error instanceof AppError_1.AppError && error.statusCode === 500 &&
            !error.message.includes("segredo-ficticio"));
    }
});
(0, node_test_1.test)("retorno não expõe secrets e não permite mutar os defaults de outra chamada", () => {
    const config = (0, magaluConfig_1.getMagaluConfig)({ MAGALU_CLIENT_SECRET: "segredo-ficticio" });
    strict_1.default.deepEqual(Object.keys(config).sort(), ["apiBaseUrl", "channelId", "environment"]);
    config.apiBaseUrl = "https://example.com";
    strict_1.default.equal((0, magaluConfig_1.getMagaluConfig)({}).apiBaseUrl, "https://api-sandbox.magalu.com");
});
//# sourceMappingURL=magaluConfig.test.js.map