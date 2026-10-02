import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";
import { sign } from "jsonwebtoken";

import { CustomerController } from "../controllers/customers/customerController";
import { errorHandler } from "../middlewares/errorHandler";
import { CustomerQueryService } from "../services/customers/CustomerQueryService";
import { fixtureId, MemoryCustomerQueryDatabase } from "../services/customers/testing/MemoryCustomerQueryDatabase";
import { createCustomerRoutes } from "./customerRoutes";

type Authentication = "bearer" | "cookie" | "missing" | "invalid";
type Get = (path?: string, auth?: Authentication, userId?: string) => Promise<Response>;

async function withApi(work: (get: Get, db: MemoryCustomerQueryDatabase) => Promise<void>) {
  const db = new MemoryCustomerQueryDatabase();
  const secret = "segredo-ficticio-apenas-para-testes-de-clientes";
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  const app = express();
  const service = new CustomerQueryService(db.readTransaction);
  app.use("/api/customers", createCustomerRoutes(new CustomerController(service)));
  app.use(errorHandler);
  const server = createServer(app);
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const get: Get = (path = "", auth = "bearer", userId = "user-a") => {
      const token = sign({}, secret, { subject: userId, expiresIn: "5m" });
      return fetch(`http://127.0.0.1:${port}/api/customers${path}`, {
        headers: auth === "cookie" ? { Cookie: `auth_token=${token}` }
          : auth === "bearer" ? { Authorization: `Bearer ${token}` }
          : auth === "invalid" ? { Authorization: "Bearer token-ficticio-invalido" } : {},
      });
    };
    await work(get, db);
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
}

test("HTTP lista e detalhes incluem documento, e busca formatada não expõe cliente alheio", async () => {
  await withApi(async (get, db) => {
    Object.assign(db.customers[0]!, { document: "12345678900", documentType: "CPF" });
    Object.assign(db.customers[3]!, { document: "00123456789", documentType: "CPF" });
    const query = new URLSearchParams({ search: "123.456.789-00" });
    const response = await get(`?${query}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].document, "12345678900");
    assert.equal(body.data[0].documentType, "CPF");
    const detail = await (await get(`/${fixtureId(1)}`)).json();
    assert.equal(detail.document, "12345678900");
    assert.equal(detail.documentType, "CPF");
    const foreign = await (await get(`?${new URLSearchParams({ search: "001.234.567-89" })}`)).json();
    assert.deepEqual(foreign.data, []);
  });
});

test("GET /customers entrega campos e paginação do contrato, sem tokens ou vínculos alheios", async () => {
  await withApi(async (get, db) => {
    const response = await get("?page=1&limit=2");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = await response.json();
    assert.deepEqual(body.pagination, { page: 1, limit: 2, total: 5, totalPages: 3 });
    assert.equal(body.data.length, 2);
    const text = JSON.stringify(body);
    for (const forbidden of ["token-", "accessToken", "refreshToken", "userId", "SECRET-900", "OUTRO-300"]) {
      assert.equal(text.includes(forbidden), false);
    }
    assert.equal(db.calls.count, 1);
    assert.equal(db.calls.findMany, 1);
  });
});

test("filtros combinados via HTTP preservam o pedido e a conta correspondentes", async () => {
  await withApi(async (get) => {
    const query = new URLSearchParams({
      search: "(11) 99999-0000", platform: "MERCADO_LIVRE",
      marketplaceAccountId: fixtureId(10), hasPhone: "true",
      dateFrom: "2026-09-01", dateTo: "2026-09-10",
    });
    const response = await get(`?${query}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.pagination.total, 1);
    assert.equal(body.data[0].externalOrderId, "ML-100");
    assert.equal(body.data[0].marketplaceAccount.id, fixtureId(10));
    assert.equal(body.data[0].orderDate, "2026-09-05T12:00:00.000Z");
  });
});

test("ambas as rotas exigem autenticação antes de consultar o banco", async () => {
  await withApi(async (get, db) => {
    for (const path of ["", `/${fixtureId(1)}`]) {
      for (const auth of ["missing", "invalid"] as const) {
        assert.equal((await get(path, auth)).status, 401);
      }
    }
    assert.equal(db.calls.transactions, 0);
  });
});

test("lista e detalhes aceitam o cookie de autenticação do sistema", async () => {
  await withApi(async (get) => {
    assert.equal((await get("", "cookie")).status, 200);
    assert.equal((await get(`/${fixtureId(1)}`, "cookie")).status, 200);
  });
});

test("GET /customers/:id retorna detalhes básicos de cliente autorizado", async () => {
  await withApi(async (get, db) => {
    const response = await get(`/${fixtureId(1)}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.customerId, fixtureId(1));
    assert.equal(body.name, "Maria Fictícia");
    assert.equal(body.phone, "5511999990000");
    assert.equal(body.externalOrderId, "MAG-200");
    assert.equal(db.calls.findFirst, 1);
  });
});

test("cliente de outro usuário e cliente inexistente recebem o mesmo 404", async () => {
  await withApi(async (get) => {
    const foreign = await get(`/${fixtureId(4)}`);
    const absent = await get(`/${fixtureId(99)}`);
    assert.equal(foreign.status, 404);
    assert.equal(absent.status, 404);
    assert.deepEqual(await foreign.json(), await absent.json());
  });
});

test("req.user_id determina a lista, inclusive quando a conta filtrada pertence a outro usuário", async () => {
  await withApi(async (get) => {
    const own = await get(`?marketplaceAccountId=${fixtureId(30)}`, "bearer", "user-b");
    assert.equal((await own.json()).pagination.total, 2);
    const foreign = await get(`?marketplaceAccountId=${fixtureId(10)}`, "bearer", "user-b");
    assert.equal((await foreign.json()).pagination.total, 0);
  });
});

for (const query of [
  "page=0", "page=-1", "page=1.5", "page=abc", "page=", "page=1&page=2",
  "limit=0", "limit=101", "limit=1000000000", "page=2147483647&limit=100",
  "platform=SHOPEE", "platform=MERCADO_LIVRE&platform=MAGALU", "marketplaceAccountId=invalido",
  "hasPhone=1", "hasPhone=TRUE", "hasPhone=false&hasPhone=true",
  "dateFrom=2026-02-30", "dateFrom=2026-10-01&dateTo=2026-09-01",
  "dateTo=2026-09-01T12:00:00", "search=" + "x".repeat(201), "userId=user-b",
]) {
  test(`valida filtros sem executar consulta: ${query.slice(0, 100)}`, async () => {
    await withApi(async (get, db) => {
      assert.equal((await get(`?${query}`)).status, 400);
      assert.equal(db.calls.transactions, 0);
    });
  });
}

test("ID de cliente malformado é recusado antes da consulta", async () => {
  await withApi(async (get, db) => {
    assert.equal((await get("/id-invalido")).status, 400);
    assert.equal(db.calls.transactions, 0);
  });
});

test("nenhum resultado mantém o envelope de paginação com totalPages zero", async () => {
  await withApi(async (get) => {
    const response = await get("?search=cliente-inexistente-ficticio");
    assert.deepEqual(await response.json(), {
      data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
  });
});
