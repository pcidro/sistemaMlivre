import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import { getMagaluConfig } from "./magaluConfig";

test("ambiente ausente usa sandbox sem precisar de credenciais", () => {
  assert.deepEqual(getMagaluConfig({}), {
    environment: "sandbox",
    apiBaseUrl: "https://api-sandbox.magalu.com",
    channelId: "5f62650a-0039-4d65-9b96-266d498c03bd",
  });
});

test("production seleciona host e channel oficiais de produção", () => {
  assert.deepEqual(getMagaluConfig({ MAGALU_ENV: "production" }), {
    environment: "production",
    apiBaseUrl: "https://api.magalu.com",
    channelId: "9fe0d853-732b-4e4a-a0b0-cff988ed043d",
  });
});

test("aceita a URL legada correspondente, vazia ou com barra final", () => {
  for (const environment of ["sandbox", "production"] as const) {
    const expected = getMagaluConfig({ MAGALU_ENV: environment });
    for (const url of [undefined, "", "  ", expected.apiBaseUrl, `${expected.apiBaseUrl}/`]) {
      assert.deepEqual(getMagaluConfig({ MAGALU_ENV: environment, MAGALU_API_URL: url }), expected);
    }
  }
});

test("erro de ambiente não assume silenciosamente produção", () => {
  for (const environment of ["", "prod", "development", "SANDBOX"]) {
    assert.throws(() => getMagaluConfig({ MAGALU_ENV: environment }),
      (error: unknown) => error instanceof AppError && error.statusCode === 500);
  }
});

test("não permite misturar host e ambiente, inclusive sem MAGALU_ENV explícito", () => {
  for (const env of [
    { MAGALU_ENV: "sandbox", MAGALU_API_URL: "https://api.magalu.com" },
    { MAGALU_ENV: "production", MAGALU_API_URL: "https://api-sandbox.magalu.com" },
    { MAGALU_API_URL: "https://api.magalu.com" },
  ]) {
    assert.throws(() => getMagaluConfig(env), /MAGALU_API_URL deve corresponder/);
  }
});

test("recusa HTTP, destinos externos, credenciais, caminhos, query e fragmentos", () => {
  for (const url of [
    "http://api-sandbox.magalu.com", "https://example.com",
    "https://api-sandbox.magalu.com.example.com", "https://api-sandbox.magalu.com:8443",
    "https://segredo-ficticio@api-sandbox.magalu.com",
    "https://api-sandbox.magalu.com/v1", "https://api-sandbox.magalu.com?token=segredo-ficticio",
    "https://api-sandbox.magalu.com#segredo-ficticio", "segredo-ficticio",
  ]) {
    assert.throws(() => getMagaluConfig({ MAGALU_API_URL: url }), (error: unknown) =>
      error instanceof AppError && error.statusCode === 500 &&
      !error.message.includes("segredo-ficticio"));
  }
});

test("retorno não expõe secrets e não permite mutar os defaults de outra chamada", () => {
  const config = getMagaluConfig({ MAGALU_CLIENT_SECRET: "segredo-ficticio" });
  assert.deepEqual(Object.keys(config).sort(), ["apiBaseUrl", "channelId", "environment"]);
  config.apiBaseUrl = "https://example.com";
  assert.equal(getMagaluConfig({}).apiBaseUrl, "https://api-sandbox.magalu.com");
});
