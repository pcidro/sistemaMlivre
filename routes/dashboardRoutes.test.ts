import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";
import { sign } from "jsonwebtoken";

import { DashboardController } from "../controllers/dashboard/dashboardController";
import { AppError } from "../errors/AppError";
import { errorHandler } from "../middlewares/errorHandler";
import type { DashboardSummary } from "../services/dashboard/DashboardService";
import { createDashboardRoutes } from "./dashboardRoutes";

const summary: DashboardSummary = {
  totalCustomers: 10, customersWithPhone: 7, customersWithoutPhone: 3,
  mercadoLivreCustomers: 9,
  lastImport: {
    startedAt: new Date("2026-10-01T12:00:00Z"), finishedAt: null,
    status: "PROCESSING", ordersProcessed: 5,
  },
};

async function withApi(
  work: (get: (authentication?: "bearer" | "cookie" | "none" | "invalid") => Promise<Response>, users: string[]) => Promise<void>,
  fail = false,
) {
  const users: string[] = [];
  const previousSecret = process.env.JWT_SECRET;
  const secret = "segredo-ficticio-do-dashboard-apenas-para-teste";
  process.env.JWT_SECRET = secret;
  const app = express();
  app.use("/api/dashboard", createDashboardRoutes(new DashboardController({
    async execute(userId) {
      users.push(userId);
      if (fail) throw new AppError("Não foi possível consultar os dados do dashboard", 503);
      return summary;
    },
  })));
  app.use(errorHandler);
  const server = createServer(app);
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const token = sign({}, secret, { subject: "user-a", expiresIn: "5m" });
    const get = (authentication: "bearer" | "cookie" | "none" | "invalid" = "bearer") => fetch(
      `http://127.0.0.1:${port}/api/dashboard?userId=user-b`, {
        headers: authentication === "bearer" ? { Authorization: `Bearer ${token}` }
          : authentication === "cookie" ? { Cookie: `auth_token=${token}` }
          : authentication === "invalid" ? { Authorization: "Bearer token-invalido-ficticio" } : {},
      },
    );
    await work(get, users);
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
}

test("GET /dashboard autenticado retorna contrato e usa req.user_id", async () => {
  await withApi(async (get, users) => {
    const response = await get();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), {
      ...summary, lastImport: { ...summary.lastImport, startedAt: "2026-10-01T12:00:00.000Z" },
    });
    assert.deepEqual(users, ["user-a"]);
  });
});

test("dashboard aceita autenticação por cookie", async () => {
  await withApi(async (get) => { assert.equal((await get("cookie")).status, 200); });
});

test("requisição sem autenticação ou com token inválido não executa consulta", async () => {
  await withApi(async (get, users) => {
    assert.equal((await get("none")).status, 401);
    assert.equal((await get("invalid")).status, 401);
    assert.equal(users.length, 0);
  });
});

test("indisponibilidade do serviço resulta em erro HTTP seguro", async () => {
  await withApi(async (get) => {
    const response = await get();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Não foi possível consultar os dados do dashboard" });
  }, true);
});
