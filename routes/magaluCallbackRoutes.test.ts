import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";
import { sign } from "jsonwebtoken";
import { MagaluCallbackController } from "../controllers/marketplaceAccounts/magaluCallbackController";
import { MagaluOAuthService } from "../integrations/magalu/MagaluOAuthService";
import { MagaluOAuthClient } from "../integrations/magalu/magaluOAuthClient";
import { MemoryMagaluStorage, oauthTestConfig, testUserId, tenantId, tokenFixture } from "../integrations/magalu/magaluOAuthTestSupport";
import { errorHandler } from "../middlewares/errorHandler";
import { createMagaluCallbackRoutes } from "./magaluCallbackRoutes";

async function withApi(work: (url: string, storage: MemoryMagaluStorage, requests: () => number) => Promise<void>, tokenError = false, frontendUrl?: string) {
  const previous = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET, TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY, FRONTEND_URL: process.env.FRONTEND_URL };
  process.env.NODE_ENV = "production";
  process.env.JWT_SECRET = "jwt-secret-ficticio";
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  if (frontendUrl === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = frontendUrl;
  const app = express();
  const storage = new MemoryMagaluStorage();
  let requests = 0;
  const client = new MagaluOAuthClient(async () => {
    requests++;
    return tokenError ? new Response("secret-ficticio access_token refresh_token", { status: 400 }) : Response.json(tokenFixture());
  });
  const service = new MagaluOAuthService(client, storage, () => oauthTestConfig);
  app.use("/api/marketplace-accounts/magalu", createMagaluCallbackRoutes(new MagaluCallbackController(service)));
  app.use(errorHandler);
  const server = createServer(app);
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    await work(`http://127.0.0.1:${port}/api/marketplace-accounts/magalu`, storage, () => requests);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
}

async function connect(url: string) {
  const token = sign({}, process.env.JWT_SECRET!, { subject: testUserId, expiresIn: "5m" });
  const response = await fetch(`${url}/connect`, { redirect: "manual", headers: { Cookie: `auth_token=${token}` } });
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("location")!);
  const cookie = response.headers.get("set-cookie")!.split(";")[0]!;
  return { response, location, cookie, state: location.searchParams.get("state")! };
}

test("connect exige usuário autenticado e envia cookie HttpOnly Secure SameSite=Lax", async () => {
  await withApi(async (url, storage) => {
    const unauthenticated = await fetch(`${url}/connect`, { redirect: "manual" });
    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticated.headers.get("location"), null);
    assert.equal(storage.states.size, 0);
    const { response, location, cookie } = await connect(url);
    assert.equal(location.origin + location.pathname, "https://id.magalu.com/login");
    assert.equal(location.searchParams.get("choose_tenants"), "true");
    const header = response.headers.get("set-cookie")!;
    for (const pattern of [/HttpOnly/, /Secure/, /SameSite=Lax/, /Max-Age=600/, /Path=\/api\/marketplace-accounts\/magalu\/callback/]) assert.match(header, pattern);
    assert.match(cookie, /^magalu_oauth_state=[a-f0-9]{64}$/);
    assert.ok(!header.includes(testUserId));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  });
});

test("callback com state válido conecta sem enviar tokens, key, code ou secret na resposta", async () => {
  await withApi(async (url, storage, requests) => {
    const { state, cookie } = await connect(url);
    const callback = `${url}/callback?code=code-ficticio&state=${state}`;
    const response = await fetch(callback, { headers: { Cookie: cookie, Accept: "application/json" } });
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.deepEqual(JSON.parse(body), { status: "connected", message: "Conta Magalu conectada com sucesso." });
    for (const sensitive of ["code-ficticio", state, "refresh-ficticio", "secret-ficticio", process.env.TOKEN_ENCRYPTION_KEY!, tokenFixture().access_token]) assert.ok(!body.includes(sensitive));
    assert.match(response.headers.get("set-cookie")!, /Expires=Thu, 01 Jan 1970/);
    assert.equal(storage.accounts.get(tenantId)?.userId, testUserId);
    assert.equal(requests(), 1);
    const replay = await fetch(callback, { headers: { Cookie: cookie } });
    assert.equal(replay.status, 400);
    assert.equal(requests(), 1);
  });
});

test("callback sem state/cookie ou com state inválido não troca code", async () => {
  await withApi(async (url, _storage, requests) => {
    const { state, cookie } = await connect(url);
    for (const [query, receivedCookie] of [
      [`code=code-ficticio&state=${state}`, ""],
      [`code=code-ficticio&state=${"a".repeat(64)}`, cookie],
      [`code=code-ficticio&state=${state}`, "magalu_oauth_state=%ZZ"],
      [`code=code-ficticio&state=${state}`, `${cookie}; ${cookie}`],
    ]) {
      const response = await fetch(`${url}/callback?${query}`, { headers: { Cookie: receivedCookie! } });
      assert.equal(response.status, 400);
    }
    assert.equal(requests(), 0);
  });
});

test("callback sem code e parâmetros repetidos, inesperados ou incompatíveis são recusados", async () => {
  await withApi(async (url, _storage, requests) => {
    const { state, cookie } = await connect(url);
    const queries = ["", `state=${state}`, "code=code", `code=&state=${state}`,
      `code=um&code=dois&state=${state}`, `code=code&state=${state}&state=${state}`,
      `code=code&state=${state}&error=access_denied`, `code=code&state=${state}&redirect_uri=https://example.com`,
      "code=code&state=%0A", "code=code&state=" + "a".repeat(2049)];
    for (const query of queries) {
      const response = await fetch(`${url}/callback?${query}`, { headers: { Cookie: cookie, Accept: "application/json" } });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).status, "not_connected");
    }
    assert.equal(requests(), 0);
  });
});

test("recusa de consentimento não reflete mensagem/URL externa e invalida state", async () => {
  await withApi(async (url, storage, requests) => {
    const { state, cookie } = await connect(url);
    const query = new URLSearchParams({ error: "access_denied", state,
      error_description: '<script>alert("secret-ficticio")</script>', error_uri: "https://example.com/secret-ficticio" });
    const response = await fetch(`${url}/callback?${query}`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 400);
    const body = await response.text();
    assert.ok(!body.includes("<script>"));
    assert.ok(!body.includes("secret-ficticio"));
    assert.ok(!body.includes(state));
    assert.equal(response.headers.get("location"), null);
    assert.equal(storage.states.size, 0);
    assert.equal(requests(), 0);
  });
});

test("falha na troca do code retorna erro seguro e não cria conta", async () => {
  await withApi(async (url, storage, requests) => {
    const { state, cookie } = await connect(url);
    const response = await fetch(`${url}/callback?code=code-ficticio&state=${state}`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes("secret-ficticio"));
    assert.equal(storage.accounts.size, 0);
    assert.equal(storage.states.size, 0);
    assert.equal(requests(), 1);
  }, true);
});

test("respostas protegem callback com no-store, no-referrer, CSP e bloqueio de frames", async () => {
  await withApi(async (url) => {
    const response = await fetch(`${url}/callback?code=code&state=ficticio`);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(response.headers.get("content-security-policy")!, /default-src 'none'/);
    assert.match(response.headers.get("x-robots-tag")!, /noindex/);
  });
});

test("URL longa, POST e HEAD são recusados sem consumir autorização", async () => {
  await withApi(async (url, storage, requests) => {
    const { state, cookie } = await connect(url);
    const oversized = await fetch(`${url}/callback?code=${"a".repeat(8300)}&state=${state}`);
    assert.equal(oversized.status, 414);
    for (const path of ["connect", "callback"]) {
      for (const method of ["POST", "HEAD"]) {
        const response = await fetch(`${url}/${path}?code=code&state=${state}`, { method, headers: { Cookie: cookie } });
        assert.equal(response.status, 405);
        assert.equal(response.headers.get("allow"), "GET");
      }
    }
    assert.equal(storage.states.size, 1);
    assert.equal(requests(), 0);
  });
});

test("rate limit não expõe a query na resposta 429", async () => {
  await withApi(async (url) => {
    for (let index = 0; index < 30; index++) {
      const response = await fetch(`${url}/callback`);
      assert.equal(response.status, 400);
      await response.text();
    }
    const response = await fetch(`${url}/callback?code=secret-ficticio&state=ficticio`);
    assert.equal(response.status, 429);
    assert.ok(response.headers.get("retry-after"));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.ok(!(await response.text()).includes("secret-ficticio"));
  });
});

test("callback de navegador retorna a Contas Integradas após persistir; não encaminha parâmetros sensíveis", async () => {
  await withApi(async (url, storage, requests) => {
    const { state, cookie } = await connect(url);
    const response = await fetch(`${url}/callback?code=code-ficticio&state=${state}`, {
      redirect: "manual", headers: { Cookie: cookie, Accept: "text/html" },
    });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "https://frontend.example/marketplace-accounts?magalu=success");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match(response.headers.get("set-cookie")!, /Expires=Thu, 01 Jan 1970/);
    assert.equal(storage.accounts.get(tenantId)?.userId, testUserId);
    assert.equal(requests(), 1);
  }, false, "https://frontend.example/?access_token=nao-encaminhar#segredo");
});

test("callback com erro de troca volta ao frontend com resultado genérico, sem criar conta", async () => {
  await withApi(async (url, storage, requests) => {
    const { state, cookie } = await connect(url);
    const response = await fetch(`${url}/callback?code=code-ficticio&state=${state}`, {
      redirect: "manual", headers: { Cookie: cookie, Accept: "text/html" },
    });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "https://frontend.example/marketplace-accounts?magalu=error");
    assert.equal(storage.accounts.size, 0); assert.equal(requests(), 1);
  }, true, "https://frontend.example");
});

test("callback malformado e state inválido retornam erro à UI sem refletir query", async () => {
  await withApi(async (url, _storage, requests) => {
    const { state } = await connect(url);
    for (const query of ["code=segredo", `code=segredo&state=${state}`]) {
      const response = await fetch(`${url}/callback?${query}`, { redirect: "manual", headers: { Accept: "text/html" } });
      assert.equal(response.status, 303);
      assert.equal(response.headers.get("location"), "https://frontend.example/marketplace-accounts?magalu=error");
    }
    assert.equal(requests(), 0);
  }, false, "https://frontend.example");
});

test("callback JSON mantém contrato e status com FRONTEND_URL configurada", async () => {
  await withApi(async url => {
    const response = await fetch(`${url}/callback`, { redirect: "manual", headers: { Accept: "application/json" } });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("location"), null);
    assert.equal((await response.json()).status, "not_connected");
  }, false, "https://frontend.example");
});

for (const frontendUrl of ["javascript:alert(1)", "http://frontend.example", "https://user:password@frontend.example", "url-invalida"]) {
  test(`callback não redireciona a frontend inválido/inseguro: ${frontendUrl}`, async () => {
    await withApi(async url => {
      const response = await fetch(`${url}/callback`, { redirect: "manual", headers: { Accept: "text/html" } });
      assert.equal(response.status, 400);
      assert.equal(response.headers.get("location"), null);
      assert.match(await response.text(), /Conexão Magalu/);
    }, false, frontendUrl);
  });
}
