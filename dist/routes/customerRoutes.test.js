"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_http_1 = require("node:http");
const node_test_1 = require("node:test");
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = require("jsonwebtoken");
const customerController_1 = require("../controllers/customers/customerController");
const errorHandler_1 = require("../middlewares/errorHandler");
const CustomerQueryService_1 = require("../services/customers/CustomerQueryService");
const MemoryCustomerQueryDatabase_1 = require("../services/customers/testing/MemoryCustomerQueryDatabase");
const customerRoutes_1 = require("./customerRoutes");
async function withApi(work) {
    const db = new MemoryCustomerQueryDatabase_1.MemoryCustomerQueryDatabase();
    const secret = "segredo-ficticio-apenas-para-testes-de-clientes";
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    const app = (0, express_1.default)();
    const service = new CustomerQueryService_1.CustomerQueryService(db.readTransaction);
    app.use("/api/customers", (0, customerRoutes_1.createCustomerRoutes)(new customerController_1.CustomerController(service)));
    app.use(errorHandler_1.errorHandler);
    const server = (0, node_http_1.createServer)(app);
    try {
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const port = server.address().port;
        const get = (path = "", auth = "bearer", userId = "user-a") => {
            const token = (0, jsonwebtoken_1.sign)({}, secret, { subject: userId, expiresIn: "5m" });
            return fetch(`http://127.0.0.1:${port}/api/customers${path}`, {
                headers: auth === "cookie" ? { Cookie: `auth_token=${token}` }
                    : auth === "bearer" ? { Authorization: `Bearer ${token}` }
                        : auth === "invalid" ? { Authorization: "Bearer token-ficticio-invalido" } : {},
            });
        };
        await work(get, db);
    }
    finally {
        server.closeAllConnections();
        if (server.listening)
            await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        if (previousSecret === undefined)
            delete process.env.JWT_SECRET;
        else
            process.env.JWT_SECRET = previousSecret;
    }
}
(0, node_test_1.test)("HTTP lista e detalhes incluem documento, e busca formatada não expõe cliente alheio", async () => {
    await withApi(async (get, db) => {
        Object.assign(db.customers[0], { document: "12345678900", documentType: "CPF" });
        Object.assign(db.customers[3], { document: "00123456789", documentType: "CPF" });
        const query = new URLSearchParams({ search: "123.456.789-00" });
        const response = await get(`?${query}`);
        strict_1.default.equal(response.status, 200);
        const body = await response.json();
        strict_1.default.equal(body.data.length, 1);
        strict_1.default.equal(body.data[0].document, "12345678900");
        strict_1.default.equal(body.data[0].documentType, "CPF");
        const detail = await (await get(`/${(0, MemoryCustomerQueryDatabase_1.fixtureId)(1)}`)).json();
        strict_1.default.equal(detail.document, "12345678900");
        strict_1.default.equal(detail.documentType, "CPF");
        const foreign = await (await get(`?${new URLSearchParams({ search: "001.234.567-89" })}`)).json();
        strict_1.default.deepEqual(foreign.data, []);
    });
});
(0, node_test_1.test)("GET /customers entrega campos e paginação do contrato, sem tokens ou vínculos alheios", async () => {
    await withApi(async (get, db) => {
        const response = await get("?page=1&limit=2");
        strict_1.default.equal(response.status, 200);
        strict_1.default.equal(response.headers.get("cache-control"), "private, no-store");
        const body = await response.json();
        strict_1.default.deepEqual(body.pagination, { page: 1, limit: 2, total: 5, totalPages: 3 });
        strict_1.default.equal(body.data.length, 2);
        const text = JSON.stringify(body);
        for (const forbidden of ["token-", "accessToken", "refreshToken", "userId", "SECRET-900", "OUTRO-300"]) {
            strict_1.default.equal(text.includes(forbidden), false);
        }
        strict_1.default.equal(db.calls.count, 1);
        strict_1.default.equal(db.calls.findMany, 1);
    });
});
(0, node_test_1.test)("filtros combinados via HTTP preservam o pedido e a conta correspondentes", async () => {
    await withApi(async (get) => {
        const query = new URLSearchParams({
            search: "(11) 99999-0000", platform: "MERCADO_LIVRE",
            marketplaceAccountId: (0, MemoryCustomerQueryDatabase_1.fixtureId)(10), hasPhone: "true",
            dateFrom: "2026-09-01", dateTo: "2026-09-10",
        });
        const response = await get(`?${query}`);
        strict_1.default.equal(response.status, 200);
        const body = await response.json();
        strict_1.default.equal(body.pagination.total, 1);
        strict_1.default.equal(body.data[0].externalOrderId, "ML-100");
        strict_1.default.equal(body.data[0].marketplaceAccount.id, (0, MemoryCustomerQueryDatabase_1.fixtureId)(10));
        strict_1.default.equal(body.data[0].orderDate, "2026-09-05T12:00:00.000Z");
    });
});
(0, node_test_1.test)("ambas as rotas exigem autenticação antes de consultar o banco", async () => {
    await withApi(async (get, db) => {
        for (const path of ["", `/${(0, MemoryCustomerQueryDatabase_1.fixtureId)(1)}`]) {
            for (const auth of ["missing", "invalid"]) {
                strict_1.default.equal((await get(path, auth)).status, 401);
            }
        }
        strict_1.default.equal(db.calls.transactions, 0);
    });
});
(0, node_test_1.test)("lista e detalhes aceitam o cookie de autenticação do sistema", async () => {
    await withApi(async (get) => {
        strict_1.default.equal((await get("", "cookie")).status, 200);
        strict_1.default.equal((await get(`/${(0, MemoryCustomerQueryDatabase_1.fixtureId)(1)}`, "cookie")).status, 200);
    });
});
(0, node_test_1.test)("GET /customers/:id retorna detalhes básicos de cliente autorizado", async () => {
    await withApi(async (get, db) => {
        const response = await get(`/${(0, MemoryCustomerQueryDatabase_1.fixtureId)(1)}`);
        strict_1.default.equal(response.status, 200);
        const body = await response.json();
        strict_1.default.equal(body.customerId, (0, MemoryCustomerQueryDatabase_1.fixtureId)(1));
        strict_1.default.equal(body.name, "Maria Fictícia");
        strict_1.default.equal(body.phone, "5511999990000");
        strict_1.default.equal(body.externalOrderId, "MAG-200");
        strict_1.default.equal(db.calls.findFirst, 1);
    });
});
(0, node_test_1.test)("cliente de outro usuário e cliente inexistente recebem o mesmo 404", async () => {
    await withApi(async (get) => {
        const foreign = await get(`/${(0, MemoryCustomerQueryDatabase_1.fixtureId)(4)}`);
        const absent = await get(`/${(0, MemoryCustomerQueryDatabase_1.fixtureId)(99)}`);
        strict_1.default.equal(foreign.status, 404);
        strict_1.default.equal(absent.status, 404);
        strict_1.default.deepEqual(await foreign.json(), await absent.json());
    });
});
(0, node_test_1.test)("req.user_id determina a lista, inclusive quando a conta filtrada pertence a outro usuário", async () => {
    await withApi(async (get) => {
        const own = await get(`?marketplaceAccountId=${(0, MemoryCustomerQueryDatabase_1.fixtureId)(30)}`, "bearer", "user-b");
        strict_1.default.equal((await own.json()).pagination.total, 2);
        const foreign = await get(`?marketplaceAccountId=${(0, MemoryCustomerQueryDatabase_1.fixtureId)(10)}`, "bearer", "user-b");
        strict_1.default.equal((await foreign.json()).pagination.total, 0);
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
    (0, node_test_1.test)(`valida filtros sem executar consulta: ${query.slice(0, 100)}`, async () => {
        await withApi(async (get, db) => {
            strict_1.default.equal((await get(`?${query}`)).status, 400);
            strict_1.default.equal(db.calls.transactions, 0);
        });
    });
}
(0, node_test_1.test)("ID de cliente malformado é recusado antes da consulta", async () => {
    await withApi(async (get, db) => {
        strict_1.default.equal((await get("/id-invalido")).status, 400);
        strict_1.default.equal(db.calls.transactions, 0);
    });
});
(0, node_test_1.test)("nenhum resultado mantém o envelope de paginação com totalPages zero", async () => {
    await withApi(async (get) => {
        const response = await get("?search=cliente-inexistente-ficticio");
        strict_1.default.deepEqual(await response.json(), {
            data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        });
    });
});
//# sourceMappingURL=customerRoutes.test.js.map