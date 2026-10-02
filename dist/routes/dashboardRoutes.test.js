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
const dashboardController_1 = require("../controllers/dashboard/dashboardController");
const AppError_1 = require("../errors/AppError");
const errorHandler_1 = require("../middlewares/errorHandler");
const dashboardRoutes_1 = require("./dashboardRoutes");
const summary = {
    totalCustomers: 10, customersWithPhone: 7, customersWithoutPhone: 3,
    mercadoLivreCustomers: 9,
    lastImport: {
        startedAt: new Date("2026-10-01T12:00:00Z"), finishedAt: null,
        status: "PROCESSING", ordersProcessed: 5,
    },
};
async function withApi(work, fail = false) {
    const users = [];
    const previousSecret = process.env.JWT_SECRET;
    const secret = "segredo-ficticio-do-dashboard-apenas-para-teste";
    process.env.JWT_SECRET = secret;
    const app = (0, express_1.default)();
    app.use("/api/dashboard", (0, dashboardRoutes_1.createDashboardRoutes)(new dashboardController_1.DashboardController({
        async execute(userId) {
            users.push(userId);
            if (fail)
                throw new AppError_1.AppError("Não foi possível consultar os dados do dashboard", 503);
            return summary;
        },
    })));
    app.use(errorHandler_1.errorHandler);
    const server = (0, node_http_1.createServer)(app);
    try {
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const port = server.address().port;
        const token = (0, jsonwebtoken_1.sign)({}, secret, { subject: "user-a", expiresIn: "5m" });
        const get = (authentication = "bearer") => fetch(`http://127.0.0.1:${port}/api/dashboard?userId=user-b`, {
            headers: authentication === "bearer" ? { Authorization: `Bearer ${token}` }
                : authentication === "cookie" ? { Cookie: `auth_token=${token}` }
                    : authentication === "invalid" ? { Authorization: "Bearer token-invalido-ficticio" } : {},
        });
        await work(get, users);
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
(0, node_test_1.test)("GET /dashboard autenticado retorna contrato e usa req.user_id", async () => {
    await withApi(async (get, users) => {
        const response = await get();
        strict_1.default.equal(response.status, 200);
        strict_1.default.equal(response.headers.get("cache-control"), "private, no-store");
        strict_1.default.deepEqual(await response.json(), {
            ...summary, lastImport: { ...summary.lastImport, startedAt: "2026-10-01T12:00:00.000Z" },
        });
        strict_1.default.deepEqual(users, ["user-a"]);
    });
});
(0, node_test_1.test)("dashboard aceita autenticação por cookie", async () => {
    await withApi(async (get) => { strict_1.default.equal((await get("cookie")).status, 200); });
});
(0, node_test_1.test)("requisição sem autenticação ou com token inválido não executa consulta", async () => {
    await withApi(async (get, users) => {
        strict_1.default.equal((await get("none")).status, 401);
        strict_1.default.equal((await get("invalid")).status, 401);
        strict_1.default.equal(users.length, 0);
    });
});
(0, node_test_1.test)("indisponibilidade do serviço resulta em erro HTTP seguro", async () => {
    await withApi(async (get) => {
        const response = await get();
        strict_1.default.equal(response.status, 503);
        strict_1.default.deepEqual(await response.json(), { error: "Não foi possível consultar os dados do dashboard" });
    }, true);
});
//# sourceMappingURL=dashboardRoutes.test.js.map