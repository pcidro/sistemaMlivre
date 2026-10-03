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
  assert.deepEqual(logged, [["Internal Server Error"]]);
  const output = JSON.stringify({ logged, captured });
  assert.ok(markers.every(marker => !output.includes(marker)));
});

test("erro HTTP Magalu preserva mensagem pública segura sem logar corpo do provedor", t => {
  const logged: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logged.push(args); });
  const { res, captured } = response();
  const error = new MagaluHttpError("A conta Magalu não possui permissão para acessar este recurso.", 403, "forbidden", 403);
  errorHandler(error, {} as Request, res, (() => {}) as NextFunction);
  assert.deepEqual(captured, { status: 403, body: { error: error.message } });
  assert.deepEqual(logged, []);
});
