import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";
import { sign } from "jsonwebtoken";
import { createImportRoutes } from "./importRoutes";
import { MercadoLivreSyncController } from "../controllers/imports/mercadoLivreSyncController";
import { MercadoLivreSyncService, type MercadoLivreSyncStorage } from "../services/imports/MercadoLivreSyncService";
import { errorHandler } from "../middlewares/errorHandler";
import { AppError } from "../errors/AppError";

const id = "00000000-0000-4000-8000-000000000030";
const accountId = "00000000-0000-4000-8000-000000000010";
const summary = { id, marketplaceAccountId: accountId, status: "PROCESSING" as const, startedAt: new Date(), finishedAt: null,
  ordersFound: 2, ordersProcessed: 1, customersWithPhone: 1, customersWithoutPhone: 0, errorsCount: 0 };

test("status e sincronização exigem sessão, isolam usuário e retornam apenas resumo seguro", async () => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "fake-session-secret";
  const users: string[] = [];
  const storage: MercadoLivreSyncStorage = {
    async register(account, owner) {
      users.push(owner);
      if (owner !== "owner" || account !== accountId) throw new AppError("Conta não encontrada", 404);
      return { summary, input: null };
    },
    async get(requested, owner) { users.push(owner); return requested === id && owner === "owner" ? summary : null; },
    async list(owner) { users.push(owner); return owner === "owner" ? [summary] : []; },
    async fail() {}, async checkpoint() {},
  };
  const app = express(); app.use(express.json());
  app.use("/api/imports", createImportRoutes(undefined, undefined, new MercadoLivreSyncController(new MercadoLivreSyncService(storage))));
  app.use(errorHandler);
  const server = createServer(app);
  try {
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/imports`;
    const request = (path: string, owner?: string, body?: unknown) => fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", ...(owner ? { Cookie: `auth_token=${sign({}, "fake-session-secret", { subject: owner, expiresIn: "5m" })}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal((await request(`/${id}`)).status, 401);
    assert.equal((await request("/mercadolivre/sync", undefined, { marketplaceAccountId: accountId })).status, 401);
    assert.equal(users.length, 0);
    const own = await request(`/${id}`, "owner");
    assert.equal(own.status, 200);
    assert.deepEqual(Object.keys(await own.json()).sort(), Object.keys(summary).sort());
    assert.equal((await request(`/${id}`, "other")).status, 404);
    assert.equal((await request("/00000000-0000-4000-8000-000000000099", "owner")).status, 404);
    assert.equal((await request("/not-uuid", "owner")).status, 400);
    assert.deepEqual(await (await request("?userId=owner", "other")).json(), []);
    assert.equal((await request("/mercadolivre/sync", "other", { marketplaceAccountId: accountId })).status, 404);
    const creates = users.length;
    assert.equal((await request("/mercadolivre/sync", "owner", { marketplaceAccountId: accountId, userId: "other" })).status, 400);
    assert.equal(users.length, creates);
    assert.equal((await request("/mercadolivre/sync", "owner", { marketplaceAccountId: accountId })).status, 202);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});
