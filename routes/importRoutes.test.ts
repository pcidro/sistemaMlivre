import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";
import { sign } from "jsonwebtoken";

import { MercadoLivreImportController } from "../controllers/imports/mercadoLivreImportController";
import { errorHandler } from "../middlewares/errorHandler";
import type { MercadoLivreImportInput } from "../services/imports/MercadoLivreImportService";
import { MercadoLivreImportService } from "../services/imports/MercadoLivreImportService";
import { createImportRoutes } from "./importRoutes";

const secret = "segredo-apenas-para-teste-ficticio";
const accountId = "4c30f898-e643-4b09-bcbd-af09e546bbae";
const summary = {
  id: "import-ficticio", marketplaceAccountId: accountId, status: "SUCCESS" as const,
  startedAt: new Date("2026-10-01T12:00:00Z"), finishedAt: new Date("2026-10-01T12:00:01Z"),
  ordersFound: 1, ordersProcessed: 1, customersWithPhone: 1, customersWithoutPhone: 0, errorsCount: 0,
};

async function withApi(
  work: (post: (body: unknown, authenticated?: boolean, cookie?: boolean) => Promise<Response>, calls: MercadoLivreImportInput[]) => Promise<void>,
  controller?: MercadoLivreImportController,
) {
  const calls: MercadoLivreImportInput[] = [];
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  const app = express();
  app.use(express.json());
  app.use("/api/imports", createImportRoutes(controller ?? new MercadoLivreImportController({
    async execute(input) { calls.push(input); return summary; },
  })));
  app.use(errorHandler);
  const server = createServer(app);
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const token = sign({}, secret, { subject: "user-ficticio", expiresIn: "5m" });
    const post = (body: unknown, authenticated = true, cookie = false) => fetch(
      `http://127.0.0.1:${port}/api/imports/mercadolivre`, {
        method: "POST", headers: {
          "Content-Type": "application/json",
          ...(authenticated ? cookie ? { Cookie: `auth_token=${token}` } : { Authorization: `Bearer ${token}` } : {}),
        }, body: JSON.stringify(body),
      },
    );
    await work(post, calls);
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
}

const body = { marketplaceAccountId: accountId, dateFrom: "2026-09-01T00:00:00-03:00", dateTo: "2026-09-30T23:59:59-03:00" };

test("POST autenticado retorna resumo e usa exclusivamente o usuário da sessão", async () => {
  await withApi(async (post, calls) => {
    const response = await post(body);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ordersProcessed, 1);
    assert.equal(calls[0]?.userId, "user-ficticio");
    assert.equal(calls[0]?.dateFrom.toISOString(), "2026-09-01T03:00:00.000Z");
  });
});

test("aceita cookie de autenticação HttpOnly utilizado pelo sistema", async () => {
  await withApi(async (post) => { assert.equal((await post(body, true, true)).status, 200); });
});

test("requisição sem autenticação é recusada antes de iniciar a importação", async () => {
  await withApi(async (post, calls) => {
    assert.equal((await post(body, false)).status, 401);
    assert.equal(calls.length, 0);
  });
});

test("aceita datas simples como dias completos em UTC", async () => {
  await withApi(async (post, calls) => {
    const response = await post({ ...body, dateFrom: "2026-09-01", dateTo: "2026-09-30" });
    assert.equal(response.status, 200);
    assert.equal(calls[0]?.dateFrom.toISOString(), "2026-09-01T00:00:00.000Z");
    assert.equal(calls[0]?.dateTo.toISOString(), "2026-09-30T23:59:59.999Z");
  });
});

for (const badBody of [
  { ...body, marketplaceAccountId: "não-uuid" },
  { ...body, dateFrom: "2026-02-30" },
  { ...body, dateTo: "2026-08-01" },
  { ...body, userId: "outro-usuario" },
  { ...body, dateFrom: "2026-09-01T12:00:00" },
  { marketplaceAccountId: accountId },
]) {
  test(`valida corpo sem iniciar importação: ${JSON.stringify(badBody)}`, async () => {
    await withApi(async (post, calls) => {
      assert.equal((await post(badBody)).status, 400);
      assert.equal(calls.length, 0);
    });
  });
}

test("usuário autenticado não pode importar conta que não lhe pertence", async () => {
  let ownershipUser: string | null = null;
  let creates = 0;
  const service = new MercadoLivreImportService({
    storage: {
      async ownsActiveAccount(_id, userId) { ownershipUser = userId; return false; },
      async create() { creates++; return summary; },
      async update() { return summary; },
    },
  });
  await withApi(async (post) => {
    const response = await post(body);
    assert.equal(response.status, 404);
    assert.equal(creates, 0);
    assert.equal(ownershipUser, "user-ficticio");
  }, new MercadoLivreImportController(service));
});
