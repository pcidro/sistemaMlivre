import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import { encryptToken, decryptToken } from "../../utils/tokenEncryption";
import type { MarketplaceOrder } from "../types";
import { magaluOrderFixtures } from "./fixtures/magaluOrders";
import { MagaluClient } from "./MagaluClient";
import { getMagaluConfig } from "./magaluConfig";
import { MagaluHttpError } from "./magaluHttpError";
import { MagaluOAuthClient } from "./magaluOAuthClient";
import { oauthTestConfig, testUserId, otherUserId, tenantId, tokenFixture } from "./magaluOAuthTestSupport";
import { MagaluOrderService } from "./MagaluOrderService";
import { MagaluRequestLimiter } from "./MagaluRequestLimiter";
import { MagaluTokenService } from "./MagaluTokenService";
import type { MagaluTokenAccount, MagaluTokenStorage, MagaluSavedTokens } from "./magaluTokenStorage";

const accountId = "00000000-0000-4000-8000-000000000010";
const requestId = "11111111-1111-4111-8111-111111111111";
const input = {
  marketplaceAccountId: accountId,
  dateFrom: new Date("2026-09-01T03:15:00-03:00"),
  dateTo: new Date("2026-09-30T23:59:59.999-03:00"),
};
const account: MagaluTokenAccount = {
  id: accountId, platform: "MAGALU", userId: testUserId, isActive: true, externalAccountId: tenantId,
  accessTokenEncrypted: "usado-apenas-com-provider-de-token-mockado",
  refreshTokenEncrypted: null, tokenExpiresAt: new Date(Date.now() + 7200_000),
};

function order(code: string) { return { ...magaluOrderFixtures.cpf, code }; }

function page(url: URL, results: unknown[], maxLimit = 100) {
  return Response.json({
    meta: {
      links: { self: url.search, next: null, previous: null },
      page: { count: results.length, offset: Number(url.searchParams.get("_offset")),
        limit: Number(url.searchParams.get("_limit")), max_limit: maxLimit },
    },
    results,
  }, { headers: { "X-Request-ID": requestId } });
}

function setup(api: (url: URL, init: RequestInit | undefined, call: number) => Response | Promise<Response>, options: {
  account?: MagaluTokenAccount | null;
  pageSize?: number;
  production?: boolean;
  tokenService?: Pick<MagaluTokenService, "getAccessToken">;
} = {}) {
  let now = Date.now();
  let lookups = 0;
  const calls: { url: URL; init: RequestInit | undefined }[] = [];
  const delays: number[] = [];
  const tokenCalls: (string | undefined)[] = [];
  const limiter = new MagaluRequestLimiter({ nowFn: () => now, sleepFn: async (delay) => {
    delays.push(delay); now += delay;
  } });
  const environment = options.production ? "production" : "sandbox";
  const config = getMagaluConfig({ MAGALU_ENV: environment });
  const service = new MagaluOrderService(testUserId, {
    pageSize: options.pageSize ?? 20,
    findAccount: async (id) => {
      lookups++;
      assert.equal(id, accountId);
      return options.account === undefined ? account : options.account;
    },
    createClient: (ownedAccount) => new MagaluClient(ownedAccount, {
      getConfig: () => config,
      getOAuthConfig: () => ({ ...oauthTestConfig, environment, audience: config.apiBaseUrl }),
      nowFn: () => now,
      limiter,
      tokenService: options.tokenService ?? { getAccessToken: async (_account, _config, rejected) => {
        tokenCalls.push(rejected);
        return rejected ? "token-renovado-ficticio" : "token-ficticio";
      } },
      fetchFn: async (url, init) => {
        const parsed = new URL(String(url));
        calls.push({ url: parsed, init });
        return api(parsed, init, calls.length);
      },
    }),
  });
  return { service, calls, delays, tokenCalls, lookups: () => lookups };
}

async function collect(service: MagaluOrderService): Promise<MarketplaceOrder[][]> {
  const batches: MarketplaceOrder[][] = [];
  for await (const batch of service.getOrders(input)) batches.push(batch);
  return batches;
}

test("uma página de dados passa pelo mapper e termina somente após página vazia", async () => {
  const fixture = setup((url, _init, call) => page(url, call === 1 ? [order("000001"), order("000002")] : []));
  const batches = await collect(fixture.service);
  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0]?.map(order => order.externalOrderId), ["000001", "000002"]);
  assert.deepEqual(batches[0]?.[0]?.customer, {
    name: "Cliente CPF de teste", phone: null, document: "00000000000", documentType: "CPF",
  });
  assert.equal(batches[0]?.[0]?.items[0]?.unitPrice, "19.90");
  assert.equal(batches[0]?.[0]?.platform, "MAGALU");
  assert.equal("code" in batches[0]![0]!, false);
  assert.deepEqual(fixture.calls.map(call => call.url.searchParams.get("_offset")), ["0", "2"]);
});

test("várias páginas curtas avançam pelo tamanho real mesmo com links.next null", async () => {
  const pages = [[order("A"), order("B")], [order("C")], [order("D"), order("E"), order("F")], []];
  const fixture = setup((url, _init, call) => page(url, pages[call - 1]!));
  const batches = await collect(fixture.service);
  assert.deepEqual(batches.map(batch => batch.length), [2, 1, 3]);
  assert.deepEqual(batches.flat().map(order => order.externalOrderId), ["A", "B", "C", "D", "E", "F"]);
  assert.deepEqual(fixture.calls.map(call => call.url.searchParams.get("_offset")), ["0", "2", "3", "6"]);
  assert.ok(fixture.calls.every(call => call.url.searchParams.get("_limit") === "20"));
});

test("nenhum pedido retorna iterador vazio após uma consulta", async () => {
  const fixture = setup(url => page(url, []));
  assert.deepEqual(await collect(fixture.service), []);
  assert.equal(fixture.calls.length, 1);
});

test("consulta é lazy e parar o consumidor impede buscar outro lote", async () => {
  const fixture = setup(url => page(url, [order("A")]));
  const iterator = fixture.service.getOrders(input);
  assert.equal(fixture.lookups(), 0);
  assert.equal(fixture.calls.length, 0);
  await iterator.next();
  assert.equal(fixture.calls.length, 1);
  await iterator.return(undefined);
  assert.equal(fixture.calls.length, 1);
});

test("intervalo completo vira ISO UTC em todas as páginas, sem arredondamento", async () => {
  const fixture = setup((url, _init, call) => page(url, call === 1 ? [order("A")] : []));
  await collect(fixture.service);
  for (const { url } of fixture.calls) {
    assert.equal(url.pathname, "/seller/v1/orders");
    assert.equal(url.origin, "https://api-sandbox.magalu.com");
    assert.equal(url.searchParams.get("purchased_at__gte"), "2026-09-01T06:15:00.000Z");
    assert.equal(url.searchParams.get("purchased_at__lte"), "2026-10-01T02:59:59.999Z");
    assert.equal(url.searchParams.get("_sort"), "purchased_at:asc");
    assert.equal(new Headers(fixture.calls[0]?.init?.headers).get("authorization"), "Bearer token-ficticio");
  }
});

test("datas capturadas antes de awaits não mudam entre lotes", async () => {
  const fixture = setup((url, _init, call) => page(url, call === 1 ? [order("A")] : []));
  const period = { ...input, dateFrom: new Date(input.dateFrom), dateTo: new Date(input.dateTo) };
  const iterator = fixture.service.getOrders(period);
  await iterator.next();
  period.dateFrom.setUTCFullYear(2000);
  period.dateTo.setUTCFullYear(2000);
  await iterator.next();
  assert.equal(fixture.calls[1]?.url.searchParams.get("purchased_at__gte"), input.dateFrom.toISOString());
});

test("data inválida, inversão e conta ausente são recusadas antes de consultar banco/API", async () => {
  const fixture = setup(url => page(url, []));
  for (const invalid of [
    { ...input, dateFrom: new Date("inválido") },
    { ...input, dateTo: new Date("inválido") },
    { ...input, dateFrom: input.dateTo, dateTo: input.dateFrom },
    { ...input, marketplaceAccountId: " " },
  ]) await assert.rejects(fixture.service.getOrders(invalid).next(), error => error instanceof AppError && error.statusCode === 400);
  assert.equal(fixture.lookups(), 0);
  assert.equal(fixture.calls.length, 0);
});

test("intervalo de um único instante é válido", async () => {
  const fixture = setup(url => page(url, []));
  await fixture.service.getOrders({ ...input, dateTo: input.dateFrom }).next();
  const params = fixture.calls[0]!.url.searchParams;
  assert.equal(params.get("purchased_at__gte"), params.get("purchased_at__lte"));
});

test("limite por lote é configurável e se adapta ao max_limit informado", async () => {
  const fixture = setup((url, _init, call) => page(url, call === 1 ? [order("A"), order("B")] : [], 2), { pageSize: 5 });
  await collect(fixture.service);
  assert.deepEqual(fixture.calls.map(call => call.url.searchParams.get("_limit")), ["5", "2"]);
});

test("exige usuário e impede lote ilimitado", () => {
  assert.throws(() => new MagaluOrderService(""), error => error instanceof AppError && error.statusCode === 401);
  for (const pageSize of [0, -1, 1.5, 101, Infinity]) {
    assert.throws(() => new MagaluOrderService(testUserId, { pageSize }), error => error instanceof AppError && error.statusCode === 400);
  }
});

test("conta inexistente, de outro usuário, inativa ou de outra plataforma não chega ao client", async () => {
  for (const invalidAccount of [null, { ...account, userId: otherUserId }, { ...account, isActive: false },
    { ...account, platform: "MERCADO_LIVRE" as const }, { ...account, id: "outra-conta" }]) {
    const fixture = setup(url => page(url, []), { account: invalidAccount });
    await assert.rejects(collect(fixture.service), error => error instanceof MagaluHttpError && error.statusCode === 404);
    assert.equal(fixture.calls.length, 0);
  }
});

test("base de produção é configurada pelo client existente", async () => {
  const fixture = setup(url => page(url, []), { production: true });
  await collect(fixture.service);
  assert.equal(fixture.calls[0]?.url.origin, "https://api.magalu.com");
});

test("429 respeita Retry-After no client e retoma o mesmo offset", async () => {
  const fixture = setup((url, _init, call) => call === 2
    ? new Response("dados-sensíveis-fictícios", { status: 429, headers: { "Retry-After": "3", "X-Request-ID": requestId } })
    : page(url, call === 1 ? [order("A")] : call === 3 ? [order("B")] : []));
  const batches = await collect(fixture.service);
  assert.deepEqual(batches.flat().map(order => order.externalOrderId), ["A", "B"]);
  assert.deepEqual(fixture.calls.map(call => call.url.searchParams.get("_offset")), ["0", "1", "1", "2"]);
  assert.ok(fixture.delays.reduce((total, ms) => total + ms, 0) >= 3000);
});

test("429 persistente encerra após três tentativas sem outro loop no serviço", async () => {
  const fixture = setup(() => new Response("DADO-SENSIVEL", { status: 429, headers: { "Retry-After": "1" } }));
  await assert.rejects(collect(fixture.service), error => error instanceof MagaluHttpError && error.code === "rate_limited");
  assert.equal(fixture.calls.length, 3);
});

test("403 propaga erro seguro com request ID e não repete consulta", async () => {
  const fixture = setup(() => new Response("DADO-SENSIVEL", { status: 403, headers: { "X-Request-ID": requestId } }));
  await assert.rejects(collect(fixture.service), error => {
    assert.ok(error instanceof MagaluHttpError);
    assert.equal(error.statusCode, 403);
    assert.equal(error.requestId, requestId);
    assert.equal(error.message.includes("DADO-SENSIVEL"), false);
    return true;
  });
  assert.equal(fixture.calls.length, 1);
});

test("401 renova uma vez pelo client e preserva paginação e filtros", async () => {
  const fixture = setup((url, _init, call) => call === 1 ? new Response(null, { status: 401 })
    : page(url, call === 2 ? [order("A")] : []));
  assert.equal((await collect(fixture.service)).flat().length, 1);
  assert.deepEqual(fixture.tokenCalls, [undefined, "token-ficticio", undefined]);
  assert.equal(new Headers(fixture.calls[1]?.init?.headers).get("authorization"), "Bearer token-renovado-ficticio");
  assert.deepEqual(fixture.calls.map(call => call.url.searchParams.get("_offset")), ["0", "0", "1"]);
});

test("erro temporário intermediário recupera o mesmo offset sem reenviar lotes anteriores", async () => {
  for (const status of [500, 503]) {
    const fixture = setup((url, _init, call) => call === 2 ? new Response(null, { status })
      : page(url, call === 1 ? [order("A")] : call === 3 ? [order("B")] : []));
    assert.deepEqual((await collect(fixture.service)).flat().map(order => order.externalOrderId), ["A", "B"]);
    assert.deepEqual(fixture.calls.map(call => call.url.searchParams.get("_offset")), ["0", "1", "1", "2"]);
  }
});

test("falha intermediária persistente mantém primeiro lote entregue e lança erro no próximo", async () => {
  const fixture = setup((url, _init, call) => call === 1 ? page(url, [order("A")]) : new Response(null, { status: 503 }));
  const iterator = fixture.service.getOrders(input);
  assert.equal((await iterator.next()).value?.[0]?.externalOrderId, "A");
  await assert.rejects(iterator.next(), error => error instanceof MagaluHttpError && error.code === "unavailable");
  assert.deepEqual(fixture.calls.map(call => call.url.searchParams.get("_offset")), ["0", "1", "1", "1"]);
  assert.equal((await iterator.next()).done, true);
});

test("payload inesperado, JSON inválido e 204 não simulam uma página vazia", async () => {
  for (const response of [Response.json({ results: [], segredo: "DADO-SENSIVEL" }),
    new Response("{DADO-SENSIVEL", { headers: { "X-Request-ID": requestId } }), new Response(null, { status: 204 })]) {
    const fixture = setup(() => response);
    await assert.rejects(collect(fixture.service), error => {
      assert.ok(error instanceof MagaluHttpError);
      assert.equal(error.code, "invalid_response");
      assert.equal(error.message.includes("DADO-SENSIVEL"), false);
      return true;
    });
    assert.equal(fixture.calls.length, 1);
  }
});

test("pedido malformado é rejeitado pelo mapper e não retorna payload bruto", async () => {
  const fixture = setup(url => page(url, [{ code: "B", customer: { name: "DADO-SENSIVEL" }, purchased_at: "inválida" }]));
  await assert.rejects(collect(fixture.service), error => {
    assert.ok(error instanceof MagaluHttpError);
    assert.equal(error.code, "invalid_response");
    assert.equal(error.requestId, requestId);
    assert.equal(error.message.includes("DADO-SENSIVEL"), false);
    return true;
  });
});

test("resposta com mais registros que o lote permitido é recusada", async () => {
  for (const size of [21, 101]) {
    const fixture = setup(url => page(url, Array.from({ length: size }, (_, index) => order(`TESTE-${index}`))));
    await assert.rejects(collect(fixture.service), error => error instanceof MagaluHttpError && error.code === "invalid_response");
    assert.equal(fixture.calls.length, 1);
  }
});

test("offset ignorado e metadados incoerentes encerram com erro seguro", async () => {
  for (const override of [{ offset: 1 }, { count: 99 }, { max_limit: 0 }, { limit: 0 }]) {
    const fixture = setup(url => Response.json({
      meta: { links: { self: url.search }, page: { count: 1, offset: 0, limit: 20, max_limit: 100, ...override } },
      results: [order("A")],
    }));
    await assert.rejects(collect(fixture.service), error => error instanceof MagaluHttpError && error.code === "invalid_response");
    assert.equal(fixture.calls.length, 1);
  }
});

test("página repetida sem progresso encerra sem guardar todo o histórico", async () => {
  const fixture = setup(url => page(url, [order("A")]));
  const iterator = fixture.service.getOrders(input);
  await iterator.next();
  await assert.rejects(iterator.next(), error => error instanceof MagaluHttpError && error.code === "invalid_response");
  assert.equal(fixture.calls.length, 2);
});

test("token expirado é renovado pelo serviço de tokens existente antes da consulta de pedidos", async (t) => {
  const originalKey = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  t.after(() => { if (originalKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY; else process.env.TOKEN_ENCRYPTION_KEY = originalKey; });
  let stored: MagaluTokenAccount = { ...account,
    accessTokenEncrypted: encryptToken(tokenFixture({ jti: "original" }).access_token),
    refreshTokenEncrypted: encryptToken("refresh-original-ficticio"), tokenExpiresAt: new Date(Date.now() - 1000),
  };
  const saved: MagaluSavedTokens[] = [];
  const storage: MagaluTokenStorage = {
    findAccount: async () => stored,
    withLockedAccount: async (_id, work) => work(stored, async tokens => {
      saved.push(tokens); stored = { ...stored, ...tokens };
    }),
  };
  let refreshes = 0;
  const refreshed = tokenFixture({ jti: "novo" });
  const tokens = new MagaluTokenService(new MagaluOAuthClient(async (_url, init) => {
    refreshes++;
    assert.ok(init?.body instanceof URLSearchParams);
    assert.equal(init.body.get("grant_type"), "refresh_token");
    return Response.json(refreshed);
  }), storage);
  const fixture = setup((url, init) => {
    assert.equal(saved.length, 1);
    assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${refreshed.access_token}`);
    return page(url, []);
  }, { account: stored, tokenService: tokens });
  await collect(fixture.service);
  assert.equal(refreshes, 1);
  assert.equal(decryptToken(stored.refreshTokenEncrypted!), refreshed.refresh_token);
  assert.notEqual(stored.accessTokenEncrypted, refreshed.access_token);
});
