import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";
import { sign } from "jsonwebtoken";

import { MagaluImportController } from "../controllers/imports/magaluImportController";
import { AppError } from "../errors/AppError";
import { errorHandler } from "../middlewares/errorHandler";
import type { ImportSummary } from "../services/imports/ImportRepository";
import { MagaluImportService } from "../services/imports/MagaluImportService";
import type { MagaluImportInput } from "../services/imports/MagaluImportService";
import { createImportRoutes } from "./importRoutes";

const accountId = "4c30f898-e643-4b09-bcbd-af09e546bbae";
const summary: ImportSummary = {
  id: "import-test", marketplaceAccountId: accountId, status: "SUCCESS",
  startedAt: new Date("2026-10-01T12:00:00Z"), finishedAt: new Date("2026-10-01T12:00:01Z"),
  ordersFound: 1, ordersProcessed: 1, customersWithPhone: 1, customersWithoutPhone: 0, errorsCount: 0,
};
const body = { marketplaceAccountId: accountId, dateFrom: "2026-09-01T00:00:00-03:00", dateTo: "2026-09-30T23:59:59-03:00" };

async function withApi(
  work: (post: (body: unknown, auth?: "bearer" | "cookie" | "none") => Promise<Response>, calls: MagaluImportInput[]) => Promise<void>,
  service?: Pick<MagaluImportService, "execute">,
) {
  const calls: MagaluImportInput[] = [];
  const previousSecret = process.env.JWT_SECRET;
  const secret = "magalu-import-secret-only-for-tests";
  process.env.JWT_SECRET = secret;
  const app = express();
  app.use(express.json());
  app.use("/api/imports", createImportRoutes(undefined, new MagaluImportController(service ?? {
    async execute(input) { calls.push(input); return summary; },
  })));
  app.use(errorHandler);
  const server = createServer(app);
  try {
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const token = sign({}, secret, { subject: "session-user", expiresIn: "5m" });
    await work((data, auth = "bearer") => fetch(`http://127.0.0.1:${port}/api/imports/magalu`, {
      method: "POST", headers: { "Content-Type": "application/json",
        ...(auth === "bearer" ? { Authorization: `Bearer ${token}` } : auth === "cookie" ? { Cookie: `auth_token=${token}` } : {}) },
      body: JSON.stringify(data),
    }), calls);
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
}

test("POST /api/imports/magalu usa req.user_id, converte offsets e retorna somente resumo", async () => {
  await withApi(async (post, calls) => {
    const response = await post(body);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), JSON.parse(JSON.stringify(summary)));
    assert.equal(calls[0]?.userId, "session-user");
    assert.equal(calls[0]?.dateFrom.toISOString(), "2026-09-01T03:00:00.000Z");
    assert.equal(calls[0]?.dateTo.toISOString(), "2026-10-01T02:59:59.000Z");
  });
});

test("rota Magalu aceita cookie do sistema e interpreta datas simples como dias completos UTC", async () => {
  await withApi(async (post, calls) => {
    assert.equal((await post({ ...body, dateFrom: "2026-09-01", dateTo: "2026-09-30" }, "cookie")).status, 200);
    assert.equal(calls[0]?.dateFrom.toISOString(), "2026-09-01T00:00:00.000Z");
    assert.equal(calls[0]?.dateTo.toISOString(), "2026-09-30T23:59:59.999Z");
  });
});

test("rota Magalu exige autenticação antes de validar o corpo ou chamar o core", async () => {
  await withApi(async (post, calls) => {
    assert.equal((await post({}, "none")).status, 401);
    assert.equal(calls.length, 0);
  });
});

for (const [reason, data] of [
  ["conta não UUID", { ...body, marketplaceAccountId: "account" }],
  ["data inexistente", { ...body, dateFrom: "2026-02-30" }],
  ["intervalo invertido", { ...body, dateTo: "2026-08-01" }],
  ["usuário enviado no corpo", { ...body, userId: "another-user" }],
  ["plataforma enviada no corpo", { ...body, platform: "MERCADO_LIVRE" }],
  ["instante sem fuso", { ...body, dateFrom: "2026-09-01T12:00:00" }],
  ["campos ausentes", { marketplaceAccountId: accountId }],
] as const) {
  test(`rota Magalu rejeita ${reason} antes da importação`, async () => {
    await withApi(async (post, calls) => {
      assert.equal((await post(data)).status, 400);
      assert.equal(calls.length, 0);
    });
  });
}

test("rota Magalu: conta não autorizada não cria Import nem consulta pedidos", async () => {
  let authorizationUser = "";
  const service = new MagaluImportService({
    storage: {
      async ownsActiveAccount(_id, userId) { authorizationUser = userId; return false; },
      async create() { assert.fail("Import não deve ser criado"); },
      async update() { assert.fail("Import não deve ser alterado"); },
    },
    orders: { async *getOrders() { assert.fail("API não deve ser consultada"); } },
  });
  await withApi(async post => {
    assert.equal((await post(body)).status, 404);
    assert.equal(authorizationUser, "session-user");
  }, service);
});

for (const status of ["PARTIAL_SUCCESS", "ERROR"] as const) {
  test(`rota Magalu devolve execução ${status} com contadores, sem payload fiscal ou credenciais`, async () => {
    const result: ImportSummary = { ...summary, status, errorsCount: 1,
      ...(status === "ERROR" ? { ordersProcessed: 0, customersWithPhone: 0 } : {}) };
    await withApi(async post => {
      const response = await post(body);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), JSON.parse(JSON.stringify(result)));
    }, { async execute() { return result; } });
  });
}

test("rota Magalu: falha de armazenamento retorna 503 sem detalhes internos", async () => {
  const service = new MagaluImportService({ storage: {
    async ownsActiveAccount() { throw new Error("SQL com credencial confidencial"); },
    async create() { assert.fail("Import não deve ser criado"); },
    async update() { assert.fail("Import não deve ser alterado"); },
  } });
  await withApi(async post => {
    const response = await post(body);
    assert.equal(response.status, 503);
    assert.equal((await response.text()).includes("confidencial"), false);
  }, service);
});

test("rota Magalu preserva conflito 409 para importação concorrente da conta", async () => {
  await withApi(async post => { assert.equal((await post(body)).status, 409); }, {
    async execute() { throw new AppError("Já existe uma importação em andamento para esta conta", 409); },
  });
});
