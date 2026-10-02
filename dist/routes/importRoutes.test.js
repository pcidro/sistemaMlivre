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
const mercadoLivreImportController_1 = require("../controllers/imports/mercadoLivreImportController");
const errorHandler_1 = require("../middlewares/errorHandler");
const MercadoLivreImportService_1 = require("../services/imports/MercadoLivreImportService");
const importRoutes_1 = require("./importRoutes");
const secret = "segredo-apenas-para-teste-ficticio";
const accountId = "4c30f898-e643-4b09-bcbd-af09e546bbae";
const summary = {
    id: "import-ficticio", marketplaceAccountId: accountId, status: "SUCCESS",
    startedAt: new Date("2026-10-01T12:00:00Z"), finishedAt: new Date("2026-10-01T12:00:01Z"),
    ordersFound: 1, ordersProcessed: 1, customersWithPhone: 1, customersWithoutPhone: 0, errorsCount: 0,
};
async function withApi(work, controller) {
    const calls = [];
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use("/api/imports", (0, importRoutes_1.createImportRoutes)(controller ?? new mercadoLivreImportController_1.MercadoLivreImportController({
        async execute(input) { calls.push(input); return summary; },
    })));
    app.use(errorHandler_1.errorHandler);
    const server = (0, node_http_1.createServer)(app);
    try {
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const port = server.address().port;
        const token = (0, jsonwebtoken_1.sign)({}, secret, { subject: "user-ficticio", expiresIn: "5m" });
        const post = (body, authenticated = true, cookie = false) => fetch(`http://127.0.0.1:${port}/api/imports/mercadolivre`, {
            method: "POST", headers: {
                "Content-Type": "application/json",
                ...(authenticated ? cookie ? { Cookie: `auth_token=${token}` } : { Authorization: `Bearer ${token}` } : {}),
            }, body: JSON.stringify(body),
        });
        await work(post, calls);
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
const body = { marketplaceAccountId: accountId, dateFrom: "2026-09-01T00:00:00-03:00", dateTo: "2026-09-30T23:59:59-03:00" };
(0, node_test_1.test)("POST autenticado retorna resumo e usa exclusivamente o usuário da sessão", async () => {
    await withApi(async (post, calls) => {
        const response = await post(body);
        strict_1.default.equal(response.status, 200);
        strict_1.default.equal((await response.json()).ordersProcessed, 1);
        strict_1.default.equal(calls[0]?.userId, "user-ficticio");
        strict_1.default.equal(calls[0]?.dateFrom.toISOString(), "2026-09-01T03:00:00.000Z");
    });
});
(0, node_test_1.test)("aceita cookie de autenticação HttpOnly utilizado pelo sistema", async () => {
    await withApi(async (post) => { strict_1.default.equal((await post(body, true, true)).status, 200); });
});
(0, node_test_1.test)("requisição sem autenticação é recusada antes de iniciar a importação", async () => {
    await withApi(async (post, calls) => {
        strict_1.default.equal((await post(body, false)).status, 401);
        strict_1.default.equal(calls.length, 0);
    });
});
(0, node_test_1.test)("aceita datas simples como dias completos em UTC", async () => {
    await withApi(async (post, calls) => {
        const response = await post({ ...body, dateFrom: "2026-09-01", dateTo: "2026-09-30" });
        strict_1.default.equal(response.status, 200);
        strict_1.default.equal(calls[0]?.dateFrom.toISOString(), "2026-09-01T00:00:00.000Z");
        strict_1.default.equal(calls[0]?.dateTo.toISOString(), "2026-09-30T23:59:59.999Z");
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
    (0, node_test_1.test)(`valida corpo sem iniciar importação: ${JSON.stringify(badBody)}`, async () => {
        await withApi(async (post, calls) => {
            strict_1.default.equal((await post(badBody)).status, 400);
            strict_1.default.equal(calls.length, 0);
        });
    });
}
(0, node_test_1.test)("usuário autenticado não pode importar conta que não lhe pertence", async () => {
    let ownershipUser = null;
    let creates = 0;
    const service = new MercadoLivreImportService_1.MercadoLivreImportService({
        storage: {
            async ownsActiveAccount(_id, userId) { ownershipUser = userId; return false; },
            async create() { creates++; return summary; },
            async update() { return summary; },
        },
    });
    await withApi(async (post) => {
        const response = await post(body);
        strict_1.default.equal(response.status, 404);
        strict_1.default.equal(creates, 0);
        strict_1.default.equal(ownershipUser, "user-ficticio");
    }, new mercadoLivreImportController_1.MercadoLivreImportController(service));
});
//# sourceMappingURL=importRoutes.test.js.map