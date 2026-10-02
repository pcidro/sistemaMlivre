import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeCustomerDocument, normalizeDocument } from "./normalizeDocument";

for (const [input, expected] of [
  ["123.456.789-00", "12345678900"], ["12345678900", "12345678900"],
  [" 12.345.678/0001-90 ", "12345678000190"], ["12345678000190", "12345678000190"],
  ["001.234.567-89", "00123456789"], [null, null], [undefined, null], ["", null],
  ["   ", null], ["123", null], ["123456789012", null], ["***.456.789-00", null],
  ["abc12345678900", null], ["AB123456000190", null],
] as const) {
  test(`normaliza documento fictício: ${JSON.stringify(input)}`, () => {
    assert.equal(normalizeDocument(input), expected);
  });
}

test("infere tipo e recusa tipo declarado incompatível ou não suportado", () => {
  assert.deepEqual(normalizeCustomerDocument("12345678900"), { document: "12345678900", documentType: "CPF" });
  assert.deepEqual(normalizeCustomerDocument("12345678000190"), { document: "12345678000190", documentType: "CNPJ" });
  for (const type of ["CNPJ", "RG"]) {
    assert.deepEqual(normalizeCustomerDocument("12345678900", type), { document: null, documentType: null });
  }
});
