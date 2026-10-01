import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizePhone } from "./normalizePhone";

test("normaliza telefone celular brasileiro formatado", () => {
  assert.equal(normalizePhone("(11) 99999-9999"), "5511999999999");
});

test("adiciona o código do Brasil ao número com DDD", () => {
  assert.equal(normalizePhone("11999999999"), "5511999999999");
});

test("preserva um número que já possui o código do Brasil", () => {
  assert.equal(normalizePhone("+55 11 99999-9999"), "5511999999999");
  assert.equal(normalizePhone("0055 11 99999-9999"), "5511999999999");
});

test("remove o zero de longa distância antes do DDD", () => {
  assert.equal(normalizePhone("011 99999-9999"), "5511999999999");
});

test("normaliza telefone fixo brasileiro", () => {
  assert.equal(normalizePhone("(11) 3333-4444"), "551133334444");
});

test("não inventa telefone quando o valor está ausente ou incompleto", () => {
  assert.equal(normalizePhone(null), null);
  assert.equal(normalizePhone(undefined), null);
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone("9999-9999"), null);
  assert.equal(normalizePhone("sem telefone"), null);
});
