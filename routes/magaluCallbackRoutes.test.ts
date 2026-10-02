import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";

import { createMagaluCallbackRoutes } from "./magaluCallbackRoutes";

async function withApi(work: (url: string) => Promise<void>) {
  const app = express();
  app.use("/api/marketplace-accounts/magalu", createMagaluCallbackRoutes());
  const server = createServer(app);
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    await work(`http://127.0.0.1:${port}/api/marketplace-accounts/magalu/callback`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("acesso público informa preparação sem autenticação nem falsa conexão", async () => {
  await withApi(async (url) => {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await response.text(), /Nenhuma conta foi conectada/);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("location"), null);
  });
});

test("protege retorno com no-store, CSP, no-referrer e bloqueio de frames", async () => {
  await withApi(async (url) => {
    const response = await fetch(`${url}?code=ficticio&state=ficticio`);
    assert.equal(response.status, 501);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'none'/);
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  });
});

test("recusa parâmetros incompletos, repetidos, inesperados ou incompatíveis", async () => {
  const queries = [
    "code=ficticio", "state=ficticio", "code=&state=ficticio",
    "code=um&code=dois&state=ficticio", "code=ficticio&state=um&state=dois",
    "code=ficticio&state=ficticio&error=access_denied",
    "error=access_denied", "code=ficticio&state=ficticio&redirect_uri=https://example.com",
    "code=ficticio&state=%0A", "code=ficticio&state=" + "a".repeat(2049),
  ];
  await withApi(async (url) => {
    for (const query of queries) {
      const response = await fetch(`${url}?${query}`, { headers: { Accept: "application/json" } });
      assert.equal(response.status, 400);
      const body = await response.json();
      assert.equal(body.status, "not_connected");
      assert.equal(response.headers.get("location"), null);
    }
  });
});

test("não aceita código sintaticamente válido como autorização, mesmo com cookie", async () => {
  await withApi(async (url) => {
    const response = await fetch(`${url}?code=segredo-ficticio&state=estado-ficticio`, {
      headers: { Accept: "application/json", Cookie: "auth_token=ficticio" },
    });
    assert.equal(response.status, 501);
    const body = await response.text();
    assert.match(body, /not_connected/);
    assert.ok(!body.includes("segredo-ficticio"));
    assert.ok(!body.includes("estado-ficticio"));
    assert.equal(response.headers.get("set-cookie"), null);
  });
});

test("não reflete descrição de erro ou URL externa e não redireciona", async () => {
  await withApi(async (url) => {
    const query = new URLSearchParams({
      error: "access_denied", state: "estado-ficticio",
      error_description: '<script>alert("dado-ficticio")</script>',
      error_uri: "https://example.com/segredo-ficticio",
    });
    const response = await fetch(`${url}?${query}`);
    assert.equal(response.status, 501);
    const body = await response.text();
    assert.ok(!body.includes("<script>"));
    assert.ok(!body.includes("segredo-ficticio"));
    assert.ok(!body.includes("estado-ficticio"));
    assert.equal(response.headers.get("location"), null);
  });
});

test("limita URL e métodos mantendo os headers de proteção", async () => {
  await withApi(async (url) => {
    const oversized = await fetch(`${url}?code=${"a".repeat(8300)}&state=ficticio`);
    assert.equal(oversized.status, 414);
    assert.equal(oversized.headers.get("referrer-policy"), "no-referrer");
    const post = await fetch(url, { method: "POST" });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get("allow"), "GET, HEAD");
    const head = await fetch(url, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  });
});

test("limita tentativas e não expõe a query na resposta 429", async () => {
  await withApi(async (url) => {
    for (let index = 0; index < 30; index++) {
      const response = await fetch(url);
      assert.equal(response.status, 200);
      await response.text();
    }
    const response = await fetch(`${url}?code=segredo-ficticio&state=ficticio`);
    assert.equal(response.status, 429);
    assert.ok(response.headers.get("retry-after"));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.ok(!(await response.text()).includes("segredo-ficticio"));
  });
});
