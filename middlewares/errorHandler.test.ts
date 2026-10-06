import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "./errorHandler";
import { MagaluHttpError } from "../integrations/magalu/magaluHttpError";

function response() {
  const captured: { status: number; body: unknown } = { status: 0, body: null };
  const res = {
    status(code: number) { captured.status = code; return res; },
    json(body: unknown) { captured.body = body; return res; },
  };
  return { captured, res: res as unknown as Response };
}

test("erro interno não imprime tokens, secret, chave de criptografia ou payload pessoal", t => {
  const logged: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logged.push(args); });
  const { res, captured } = response();
  const markers = ["access-token-ficticio", "refresh-token-ficticio", "client-secret-ficticio", "encryption-key-ficticia", "xml-ficticio", "cpf-ficticio"];
  errorHandler(new Error(markers.join(" ")), {} as Request, res, (() => {}) as NextFunction);
  assert.deepEqual(captured, { status: 500, body: { error: "Erro interno no servidor" } });
  assert.deepEqual(logged, [["internal_server_error", { reason: "unexpected", code: null, area: null, method: null }]]);
  const output = JSON.stringify({ logged, captured });
  assert.ok(markers.every(marker => !output.includes(marker)));
});

for (const [code, reason] of [
  ["P2022", "database_column_missing"], ["P2021", "database_table_missing"],
  ["P1001", "database_unreachable"], ["P1000", "database_authentication_failed"],
  ["P2024", "database_pool_timeout"],
] as const) {
  test(`diagnóstico ${code} identifica causa e área sem logar query, SQL, meta ou credenciais`, t => {
    const logged: unknown[][] = [];
    t.mock.method(console, "error", (...args: unknown[]) => { logged.push(args); });
    const marker = "secret-token-cpf-telefone-nao-logar";
    const error = Object.assign(new Error(marker), { code, meta: { column: marker, connectionString: marker } });
    const req = { path: `/api/imports/${marker}`, method: "GET", originalUrl: `/api/imports/${marker}?secret=${marker}`, headers: { authorization: marker } } as unknown as Request;
    const { res, captured } = response();
    errorHandler(error, req, res, (() => {}) as NextFunction);
    assert.deepEqual(logged, [["internal_server_error", { reason, code, area: "imports", method: "GET" }]]);
    assert.equal(captured.status, 500);
    assert.ok(!JSON.stringify({ logged, captured }).includes(marker));
  });
}

for (const code of ["secret-token-never-log", "__proto__", "constructor"]) {
  test(`código arbitrário não é ecoado nem tratado como código conhecido (${code === "secret-token-never-log" ? "privado" : code})`, t => {
    const logged: unknown[][] = [];
    t.mock.method(console, "error", (...args: unknown[]) => { logged.push(args); });
    const { res } = response();
    errorHandler(Object.assign(new Error("private"), { code }), {} as Request, res, (() => {}) as NextFunction);
    assert.deepEqual(logged, [["internal_server_error", { reason: "unexpected", code: null, area: null, method: null }]]);
  });
}

test("erro HTTP Magalu preserva mensagem pública segura sem logar corpo do provedor", t => {
  const logged: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logged.push(args); });
  const { res, captured } = response();
  const error = new MagaluHttpError("A conta Magalu não possui permissão para acessar este recurso.", 403, "forbidden", 403);
  errorHandler(error, {} as Request, res, (() => {}) as NextFunction);
  assert.deepEqual(captured, { status: 403, body: { error: error.message } });
  assert.deepEqual(logged, []);
});
