"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const node_test_1 = require("node:test");
const tokenEncryption_1 = require("./tokenEncryption");
const originalEncryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
(0, node_test_1.beforeEach)(() => {
    process.env.TOKEN_ENCRYPTION_KEY = (0, node_crypto_1.randomBytes)(32).toString("base64");
});
(0, node_test_1.afterEach)(() => {
    if (originalEncryptionKey === undefined) {
        delete process.env.TOKEN_ENCRYPTION_KEY;
        return;
    }
    process.env.TOKEN_ENCRYPTION_KEY = originalEncryptionKey;
});
(0, node_test_1.test)("criptografa um token sem manter o valor original", () => {
    const token = "APP_USR-123456789";
    const encrypted = (0, tokenEncryption_1.encryptToken)(token);
    strict_1.default.notEqual(encrypted, token);
    strict_1.default.match(encrypted, /^v1\./);
});
(0, node_test_1.test)("descriptografa e recupera exatamente o token original", () => {
    const token = "APP_USR-123456789";
    strict_1.default.equal((0, tokenEncryption_1.decryptToken)((0, tokenEncryption_1.encryptToken)(token)), token);
});
(0, node_test_1.test)("usa um IV aleatório em cada criptografia", () => {
    const token = "APP_USR-123456789";
    strict_1.default.notEqual((0, tokenEncryption_1.encryptToken)(token), (0, tokenEncryption_1.encryptToken)(token));
});
(0, node_test_1.test)("falha claramente quando TOKEN_ENCRYPTION_KEY está ausente", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    strict_1.default.throws(() => (0, tokenEncryption_1.encryptToken)("APP_USR-123456789"), tokenEncryption_1.TokenEncryptionConfigurationError);
});
(0, node_test_1.test)("falha claramente quando TOKEN_ENCRYPTION_KEY é inválida", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "chave-invalida";
    strict_1.default.throws(() => (0, tokenEncryption_1.encryptToken)("APP_USR-123456789"), tokenEncryption_1.TokenEncryptionConfigurationError);
});
(0, node_test_1.test)("rejeita conteúdo criptografado adulterado", () => {
    const parts = (0, tokenEncryption_1.encryptToken)("APP_USR-123456789").split(".");
    const ciphertext = parts[3] ?? "";
    parts[3] = `${ciphertext.startsWith("A") ? "B" : "A"}${ciphertext.slice(1)}`;
    strict_1.default.throws(() => (0, tokenEncryption_1.decryptToken)(parts.join(".")), tokenEncryption_1.TokenDecryptionError);
});
(0, node_test_1.test)("criptografa e descriptografa tokens longos", () => {
    const token = `APP_USR-${"x".repeat(100_000)}`;
    strict_1.default.equal((0, tokenEncryption_1.decryptToken)((0, tokenEncryption_1.encryptToken)(token)), token);
});
//# sourceMappingURL=tokenEncryption.test.js.map