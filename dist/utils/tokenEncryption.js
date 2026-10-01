"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenDecryptionError = exports.TokenEncryptionConfigurationError = void 0;
exports.encryptToken = encryptToken;
exports.decryptToken = decryptToken;
const node_crypto_1 = require("node:crypto");
const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_VERSION = "v1";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;
class TokenEncryptionConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = "TokenEncryptionConfigurationError";
        Object.setPrototypeOf(this, TokenEncryptionConfigurationError.prototype);
    }
}
exports.TokenEncryptionConfigurationError = TokenEncryptionConfigurationError;
class TokenDecryptionError extends Error {
    constructor() {
        super("Não foi possível descriptografar o token de marketplace");
        this.name = "TokenDecryptionError";
        Object.setPrototypeOf(this, TokenDecryptionError.prototype);
    }
}
exports.TokenDecryptionError = TokenDecryptionError;
function getEncryptionKey() {
    const configuredKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!configuredKey) {
        throw new TokenEncryptionConfigurationError("TOKEN_ENCRYPTION_KEY não configurada");
    }
    const key = Buffer.from(configuredKey, "base64");
    const isCanonicalBase64 = key.toString("base64") === configuredKey;
    if (key.length !== KEY_LENGTH_BYTES || !isCanonicalBase64) {
        throw new TokenEncryptionConfigurationError("TOKEN_ENCRYPTION_KEY deve ser uma chave Base64 válida de 32 bytes");
    }
    return key;
}
function decodePayloadPart(value) {
    if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
        throw new TokenDecryptionError();
    }
    return Buffer.from(value, "base64url");
}
function encryptToken(value) {
    const key = getEncryptionKey();
    const iv = (0, node_crypto_1.randomBytes)(IV_LENGTH_BYTES);
    const cipher = (0, node_crypto_1.createCipheriv)(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    cipher.setAAD(Buffer.from(ENCRYPTION_VERSION, "utf8"));
    const ciphertext = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
        ENCRYPTION_VERSION,
        iv.toString("base64url"),
        authTag.toString("base64url"),
        ciphertext.toString("base64url"),
    ].join(".");
}
function decryptToken(encryptedValue) {
    const key = getEncryptionKey();
    try {
        const parts = encryptedValue.split(".");
        if (parts.length !== 4 || parts[0] !== ENCRYPTION_VERSION) {
            throw new TokenDecryptionError();
        }
        const iv = decodePayloadPart(parts[1] ?? "");
        const authTag = decodePayloadPart(parts[2] ?? "");
        const ciphertext = decodePayloadPart(parts[3] ?? "");
        if (iv.length !== IV_LENGTH_BYTES ||
            authTag.length !== AUTH_TAG_LENGTH_BYTES) {
            throw new TokenDecryptionError();
        }
        const decipher = (0, node_crypto_1.createDecipheriv)(ALGORITHM, key, iv, {
            authTagLength: AUTH_TAG_LENGTH_BYTES,
        });
        decipher.setAAD(Buffer.from(ENCRYPTION_VERSION, "utf8"));
        decipher.setAuthTag(authTag);
        return Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]).toString("utf8");
    }
    catch (error) {
        if (error instanceof TokenDecryptionError) {
            throw error;
        }
        throw new TokenDecryptionError();
    }
}
//# sourceMappingURL=tokenEncryption.js.map