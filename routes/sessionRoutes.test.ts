import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";
import { sign } from "jsonwebtoken";
import { SessionController } from "../controllers/auth/sessionController";
import { errorHandler } from "../middlewares/errorHandler";
import { createSessionRoutes } from "./sessionRoutes";
import { preventApiCaching } from "../middlewares/preventApiCaching";

test("sessão usa req.user_id, exige autenticação e logout limpa cookie com as opções do login", async () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousEnvironment = process.env.NODE_ENV;
  const secret = "segredo-ficticio-testes-sessao";
  process.env.JWT_SECRET = secret;
  process.env.NODE_ENV = "production";
  const user = {
    id: "user-a", name: "Pessoa Fictícia", username: "pessoa", email: "pessoa@example.com",
    role: "USER" as const, avatarUrl: null, createdAt: new Date(), updatedAt: new Date(),
  };
  const ids: string[] = [];
  const controller = new SessionController(async (id) => { ids.push(id); return id === user.id ? user : null; });
  const app = express();
  app.use("/api", preventApiCaching);
  app.use("/api/auth", createSessionRoutes(controller));
  app.use(errorHandler);
  const server = createServer(app);
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth`;
    const unauthenticated = await fetch(`${base}/me`);
    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticated.headers.get("cache-control"), "private, no-store");
    assert.equal(ids.length, 0);
    const token = sign({}, secret, { subject: user.id, expiresIn: "5m" });
    const response = await fetch(`${base}/me?user_id=outro`, { headers: { Cookie: `auth_token=${token}` } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(ids, [user.id]);
    const body = await response.json();
    assert.equal(body.email, user.email);
    assert.equal(body.id, user.id);
    assert.ok(!JSON.stringify(body).includes("token"));
    const removed = sign({}, secret, { subject: "removed-user", expiresIn: "5m" });
    assert.equal((await fetch(`${base}/me`, { headers: { Cookie: `auth_token=${removed}` } })).status, 401);
    const logout = await fetch(`${base}/logout`, { method: "POST", headers: { Cookie: "auth_token=expired" } });
    assert.equal(logout.status, 204);
    const cookie = logout.headers.get("set-cookie") ?? "";
    assert.match(cookie, /auth_token=;/);
    assert.match(cookie, /Path=\//);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=None/);
    assert.match(cookie, /Expires=Thu, 01 Jan 1970/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});
