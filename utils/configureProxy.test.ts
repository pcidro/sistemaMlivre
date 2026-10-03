import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";
import { rateLimit } from "express-rate-limit";

import { configureProxy } from "./configureProxy";

test("fora do Render ignora cabeçalhos de proxy fornecidos diretamente pelo cliente", async () => {
  const app = express();
  configureProxy(app, {});
  app.get("/", (req, res) => res.json({ ip: req.ip, secure: req.secure }));
  const server = createServer(app);
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, {
      headers: { "X-Forwarded-For": "198.51.100.1", "X-Forwarded-Proto": "https" },
    });
    assert.deepEqual(await response.json(), { ip: "127.0.0.1", secure: false });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("Render aceita um hop e limita por endereço sem confiar em IPs extras à esquerda", async (context) => {
  const logger = context.mock.method(console, "error", () => {});
  const app = express();
  configureProxy(app, { RENDER: "true" });
  app.use(rateLimit({ windowMs: 60_000, limit: 1, legacyHeaders: false }));
  app.get("/", (req, res) => res.json({ ip: req.ip, secure: req.secure }));
  const server = createServer(app);
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const request = (forwarded: string) => fetch(url, { headers: { "X-Forwarded-For": forwarded, "X-Forwarded-Proto": "https" } });
    const first = await request("203.0.113.1, 198.51.100.10");
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { ip: "198.51.100.10", secure: true });
    assert.equal((await request("203.0.113.99, 198.51.100.10")).status, 429);
    assert.equal((await request("203.0.113.1, 198.51.100.11")).status, 200);
    assert.equal(logger.mock.callCount(), 0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
