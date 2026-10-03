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
const sessionController_1 = require("../controllers/auth/sessionController");
const errorHandler_1 = require("../middlewares/errorHandler");
const sessionRoutes_1 = require("./sessionRoutes");
const preventApiCaching_1 = require("../middlewares/preventApiCaching");
(0, node_test_1.test)("sessão usa req.user_id, exige autenticação e logout limpa cookie com as opções do login", async () => {
    const previousSecret = process.env.JWT_SECRET;
    const previousEnvironment = process.env.NODE_ENV;
    const secret = "segredo-ficticio-testes-sessao";
    process.env.JWT_SECRET = secret;
    process.env.NODE_ENV = "production";
    const user = {
        id: "user-a", name: "Pessoa Fictícia", username: "pessoa", email: "pessoa@example.com",
        role: "USER", avatarUrl: null, createdAt: new Date(), updatedAt: new Date(),
    };
    const ids = [];
    const controller = new sessionController_1.SessionController(async (id) => { ids.push(id); return id === user.id ? user : null; });
    const app = (0, express_1.default)();
    app.use("/api", preventApiCaching_1.preventApiCaching);
    app.use("/api/auth", (0, sessionRoutes_1.createSessionRoutes)(controller));
    app.use(errorHandler_1.errorHandler);
    const server = (0, node_http_1.createServer)(app);
    try {
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const base = `http://127.0.0.1:${server.address().port}/api/auth`;
        const unauthenticated = await fetch(`${base}/me`);
        strict_1.default.equal(unauthenticated.status, 401);
        strict_1.default.equal(unauthenticated.headers.get("cache-control"), "private, no-store");
        strict_1.default.equal(ids.length, 0);
        const token = (0, jsonwebtoken_1.sign)({}, secret, { subject: user.id, expiresIn: "5m" });
        const response = await fetch(`${base}/me?user_id=outro`, { headers: { Cookie: `auth_token=${token}` } });
        strict_1.default.equal(response.status, 200);
        strict_1.default.equal(response.headers.get("cache-control"), "private, no-store");
        strict_1.default.deepEqual(ids, [user.id]);
        const body = await response.json();
        strict_1.default.equal(body.email, user.email);
        strict_1.default.equal(body.id, user.id);
        strict_1.default.ok(!JSON.stringify(body).includes("token"));
        const removed = (0, jsonwebtoken_1.sign)({}, secret, { subject: "removed-user", expiresIn: "5m" });
        strict_1.default.equal((await fetch(`${base}/me`, { headers: { Cookie: `auth_token=${removed}` } })).status, 401);
        const logout = await fetch(`${base}/logout`, { method: "POST", headers: { Cookie: "auth_token=expired" } });
        strict_1.default.equal(logout.status, 204);
        const cookie = logout.headers.get("set-cookie") ?? "";
        strict_1.default.match(cookie, /auth_token=;/);
        strict_1.default.match(cookie, /Path=\//);
        strict_1.default.match(cookie, /HttpOnly/);
        strict_1.default.match(cookie, /Secure/);
        strict_1.default.match(cookie, /SameSite=None/);
        strict_1.default.match(cookie, /Expires=Thu, 01 Jan 1970/);
    }
    finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(() => resolve()));
        if (previousSecret === undefined)
            delete process.env.JWT_SECRET;
        else
            process.env.JWT_SECRET = previousSecret;
        if (previousEnvironment === undefined)
            delete process.env.NODE_ENV;
        else
            process.env.NODE_ENV = previousEnvironment;
    }
});
//# sourceMappingURL=sessionRoutes.test.js.map