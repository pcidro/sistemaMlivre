import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";

import {
  decryptToken,
  encryptToken,
  TokenDecryptionError,
  TokenEncryptionConfigurationError,
} from "./tokenEncryption";

const originalEncryptionKey = process.env.TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

afterEach(() => {
  if (originalEncryptionKey === undefined) {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    return;
  }

  process.env.TOKEN_ENCRYPTION_KEY = originalEncryptionKey;
});

test("criptografa um token sem manter o valor original", () => {
  const token = "APP_USR-123456789";
  const encrypted = encryptToken(token);

  assert.notEqual(encrypted, token);
  assert.match(encrypted, /^v1\./);
});

test("descriptografa e recupera exatamente o token original", () => {
  const token = "APP_USR-123456789";

  assert.equal(decryptToken(encryptToken(token)), token);
});

test("usa um IV aleatório em cada criptografia", () => {
  const token = "APP_USR-123456789";

  assert.notEqual(encryptToken(token), encryptToken(token));
});

test("falha claramente quando TOKEN_ENCRYPTION_KEY está ausente", () => {
  delete process.env.TOKEN_ENCRYPTION_KEY;

  assert.throws(
    () => encryptToken("APP_USR-123456789"),
    TokenEncryptionConfigurationError,
  );
});

test("falha claramente quando TOKEN_ENCRYPTION_KEY é inválida", () => {
  process.env.TOKEN_ENCRYPTION_KEY = "chave-invalida";

  assert.throws(
    () => encryptToken("APP_USR-123456789"),
    TokenEncryptionConfigurationError,
  );
});

test("rejeita conteúdo criptografado adulterado", () => {
  const parts = encryptToken("APP_USR-123456789").split(".");
  const ciphertext = parts[3] ?? "";

  parts[3] = `${ciphertext.startsWith("A") ? "B" : "A"}${ciphertext.slice(1)}`;

  assert.throws(() => decryptToken(parts.join(".")), TokenDecryptionError);
});

test("criptografa e descriptografa tokens longos", () => {
  const token = `APP_USR-${"x".repeat(100_000)}`;

  assert.equal(decryptToken(encryptToken(token)), token);
});
