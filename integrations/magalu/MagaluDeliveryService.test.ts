import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import type { MarketplaceDelivery } from "../types";
import { deliveryFixture, deliveryOrderCode, fixtureProductionChannelId } from "./fixtures/magaluDeliveries";
import { MagaluClient } from "./MagaluClient";
import { getMagaluConfig } from "./magaluConfig";
import { MagaluDeliveryService } from "./MagaluDeliveryService";
import { MagaluHttpError } from "./magaluHttpError";
import { oauthTestConfig, testUserId, otherUserId, tenantId } from "./magaluOAuthTestSupport";
import { MagaluRequestLimiter } from "./MagaluRequestLimiter";
import type { MagaluTokenAccount } from "./magaluTokenStorage";

const deliveryId = "00000000-0000-4000-8000-000000000030";
const secondDeliveryId = "00000000-0000-4000-8000-000000000031";
const accountId = "00000000-0000-4000-8000-000000000010";
const requestId = "11111111-1111-4111-8111-111111111111";
const input = { marketplaceAccountId: accountId, externalOrderId: deliveryOrderCode };
const account: MagaluTokenAccount = {
  id: accountId, platform: "MAGALU", userId: testUserId, isActive: true, externalAccountId: tenantId,
  accessTokenEncrypted: "usado-apenas-com-provider-de-token-mockado",
  refreshTokenEncrypted: null, tokenExpiresAt: new Date(Date.now() + 7200_000),
};

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

function setup(api: (url: URL, init: RequestInit | undefined, call: number, channel: string) => Response | Promise<Response>, options: {
  production?: boolean;
  orderResponse?: () => Response;
  account?: MagaluTokenAccount | null;
  pageSize?: number;
} = {}) {
  const config = getMagaluConfig({ MAGALU_ENV: options.production ? "production" : "sandbox" });
  const channelId = options.production ? fixtureProductionChannelId : config.channelId;
  let now = Date.now();
  let lookups = 0;
  let deliveryCalls = 0;
  const calls: { url: URL; init: RequestInit | undefined; at: number }[] = [];
  const delays: number[] = [];
  const limiter = new MagaluRequestLimiter({ nowFn: () => now, sleepFn: async delay => {
    delays.push(delay); now += delay;
  } });
  const service = new MagaluDeliveryService(testUserId, {
    pageSize: options.pageSize ?? 20,
    getConfig: () => config,
    findAccount: async id => {
      lookups++;
      assert.equal(id, accountId);
      return options.account === undefined ? account : options.account;
    },
    createClient: ownedAccount => new MagaluClient(ownedAccount, {
      getConfig: () => config,
      getOAuthConfig: () => ({ ...oauthTestConfig, environment: config.environment, audience: config.apiBaseUrl }),
      nowFn: () => now, limiter,
      tokenService: { getAccessToken: async () => "token-ficticio" },
      fetchFn: async (url, init) => {
        const parsed = new URL(String(url));
        calls.push({ url: parsed, init, at: now });
        if (parsed.pathname.startsWith("/seller/v1/orders/")) {
          return options.orderResponse?.() ?? Response.json({ code: deliveryOrderCode, channel: { id: channelId } },
            { headers: { "X-Request-ID": requestId } });
        }
        assert.equal(parsed.pathname, "/seller/v1/deliveries");
        return api(parsed, init, ++deliveryCalls, channelId);
      },
    }),
  });
  return { service, calls, delays, channelId, lookups: () => lookups };
}

async function collect(service: MagaluDeliveryService): Promise<MarketplaceDelivery[][]> {
  const batches: MarketplaceDelivery[][] = [];
  for await (const batch of service.getDeliveries(input)) batches.push(batch);
  return batches;
}

test("pedido com uma entrega retorna apenas referência normalizada para futura NF-e", async () => {
  const fixture = setup((url, _init, call, channel) => page(url, call === 1 ? [{
    ...deliveryFixture(deliveryId, channel), shipping: { recipient: { name: "DADO-SENSIVEL" } }, invoices: [{ key: "NÃO-EXPORTAR" }],
  }] : []));
  assert.deepEqual(await collect(fixture.service), [[{
    externalDeliveryId: deliveryId, externalDeliveryCode: `${deliveryOrderCode}-1`, externalOrderId: deliveryOrderCode,
    marketplaceAccountId: accountId, platform: "MAGALU", channelId: fixture.channelId, status: "invoiced",
  }]]);
  assert.equal(fixture.calls.length, 2);
  assert.ok(fixture.calls.every(call => !call.url.pathname.includes("invoices")));
});

test("pedido com várias entregas preserva os IDs dos pacotes", async () => {
  const fixture = setup((url, _init, call, channel) => page(url, call === 1 ? [
    deliveryFixture(deliveryId, channel), { ...deliveryFixture(secondDeliveryId, channel), status: "shipped", code: `${deliveryOrderCode}-2` },
  ] : []));
  const deliveries = (await collect(fixture.service)).flat();
  assert.deepEqual(deliveries.map(delivery => delivery.externalDeliveryId), [deliveryId, secondDeliveryId]);
  assert.deepEqual(deliveries.map(delivery => delivery.status), ["invoiced", "shipped"]);
});

test("sem entrega retorna iterador vazio sem presumir erro 404", async () => {
  const fixture = setup(url => page(url, []));
  assert.deepEqual(await collect(fixture.service), []);
  assert.equal(fixture.calls.length, 1);
});

test("sandbox usa exclusivamente canal oficial configurado e não consulta pedido de produção", async () => {
  const fixture = setup(url => page(url, []));
  await collect(fixture.service);
  const request = fixture.calls[0]!;
  assert.equal(request.url.origin, "https://api-sandbox.magalu.com");
  assert.equal(new Headers(request.init?.headers).get("x-channel-id"), getMagaluConfig({ MAGALU_ENV: "sandbox" }).channelId);
  assert.equal(request.url.searchParams.get("code"), deliveryOrderCode);
  assert.equal(request.url.searchParams.get("_offset"), "0");
  assert.equal(request.url.searchParams.get("_limit"), "20");
  assert.equal(new Headers(request.init?.headers).get("authorization"), "Bearer token-ficticio");
});

test("produção obtém canal do pedido na API e ignora canal de produção da configuração", async () => {
  const fixture = setup((url, _init, call, channel) => page(url, call === 1 ? [deliveryFixture(deliveryId, channel)] : []), { production: true });
  const deliveries = (await collect(fixture.service)).flat();
  assert.notEqual(fixture.channelId, getMagaluConfig({ MAGALU_ENV: "production" }).channelId);
  assert.equal(fixture.calls[0]?.url.pathname, `/seller/v1/orders/${deliveryOrderCode}`);
  assert.equal(new Headers(fixture.calls[0]?.init?.headers).get("x-channel-id"), null);
  for (const request of fixture.calls.slice(1)) {
    assert.equal(request.url.origin, "https://api.magalu.com");
    assert.equal(new Headers(request.init?.headers).get("x-channel-id"), fixtureProductionChannelId);
  }
  assert.equal(deliveries[0]?.channelId, fixtureProductionChannelId);
});

test("produção sem canal válido no pedido falha sem recorrer a UUID de exemplo", async () => {
  for (const body of [{ code: deliveryOrderCode }, { code: deliveryOrderCode, channel: { id: "inválido" } },
    { code: "OUTRO-PEDIDO", channel: { id: fixtureProductionChannelId } }]) {
    const fixture = setup(url => page(url, []), { production: true, orderResponse: () => Response.json(body) });
    await assert.rejects(collect(fixture.service), error => error instanceof MagaluHttpError && error.code === "invalid_response");
    assert.equal(fixture.calls.length, 1);
  }
});

test("aceita UUID de canal em maiúsculas vindo da API sem perder a identidade", async () => {
  const channel = "abcdef00-0000-4000-8000-000000000020";
  const fixture = setup((url, _init, call) => page(url, call === 1 ? [deliveryFixture(deliveryId, channel.toUpperCase())] : []),
    { production: true, orderResponse: () => Response.json({ code: deliveryOrderCode, channel: { id: channel.toUpperCase() } }) });
  assert.equal((await collect(fixture.service)).flat()[0]?.channelId, channel);
  assert.equal(new Headers(fixture.calls[1]?.init?.headers).get("x-channel-id"), channel);
});

test("entrega de outro pedido ou canal é rejeitada antes de sair da integração", async () => {
  for (const mismatch of ["order", "channel"]) {
    const fixture = setup((url, _init, _call, channel) => {
      const raw = deliveryFixture(deliveryId, channel);
      if (mismatch === "order") raw.order.code = "OUTRO-PEDIDO";
      else raw.order.channel.id = fixtureProductionChannelId;
      return page(url, [raw]);
    });
    await assert.rejects(collect(fixture.service), error => error instanceof MagaluHttpError && error.code === "invalid_response");
    assert.equal(fixture.calls.length, 1);
  }
});

test("erro 404 de deliveries é explícito, preserva diagnóstico e não retorna lista vazia", async () => {
  const fixture = setup(() => new Response("DADO-SENSIVEL", { status: 404, headers: { "X-Request-ID": requestId } }));
  await assert.rejects(collect(fixture.service), error => {
    assert.ok(error instanceof MagaluHttpError);
    assert.equal(error.code, "not_found");
    assert.equal(error.providerStatus, 404);
    assert.equal(error.requestId, requestId);
    assert.equal(error.message.includes("DADO-SENSIVEL"), false);
    return true;
  });
  assert.equal(fixture.calls.length, 1);
});

test("404 ao resolver pedido em produção impede consulta sem canal", async () => {
  const fixture = setup(url => page(url, []), { production: true, orderResponse: () => new Response(null, { status: 404 }) });
  await assert.rejects(collect(fixture.service), error => error instanceof MagaluHttpError && error.code === "not_found");
  assert.equal(fixture.calls.length, 1);
});

test("429 respeita Retry-After e repete mesmo pedido, canal e offset pelo client", async () => {
  const fixture = setup((url, _init, call, channel) => call === 1
    ? new Response(null, { status: 429, headers: { "Retry-After": "3" } })
    : page(url, call === 2 ? [deliveryFixture(deliveryId, channel)] : []));
  assert.equal((await collect(fixture.service)).flat().length, 1);
  assert.deepEqual(fixture.calls.map(call => call.url.searchParams.get("_offset")), ["0", "0", "1"]);
  assert.ok(fixture.calls[1]!.at - fixture.calls[0]!.at >= 3000);
  assert.ok(fixture.calls.every(call => new Headers(call.init?.headers).get("x-channel-id") === fixture.channelId));
});

test("429 persistente encerra depois de três chamadas sem retries duplicados", async () => {
  const fixture = setup(() => new Response(null, { status: 429, headers: { "Retry-After": "1" } }));
  await assert.rejects(collect(fixture.service), error => error instanceof MagaluHttpError && error.code === "rate_limited");
  assert.equal(fixture.calls.length, 3);
});

test("pagina pacotes em lotes sem encerrar após página curta", async () => {
  const fixture = setup((url, _init, call, channel) => page(url,
    call === 1 ? [deliveryFixture(deliveryId, channel)] : call === 2 ? [deliveryFixture(secondDeliveryId, channel)] : []));
  const batches = await collect(fixture.service);
  assert.deepEqual(batches.map(batch => batch.length), [1, 1]);
  assert.deepEqual(fixture.calls.map(call => call.url.searchParams.get("_offset")), ["0", "1", "2"]);
});

test("reduz tamanho do lote se a API informar max_limit menor", async () => {
  const fixture = setup((url, _init, call, channel) => page(url, call === 1 ? [deliveryFixture(deliveryId, channel)] : [], 1), { pageSize: 5 });
  await collect(fixture.service);
  assert.deepEqual(fixture.calls.map(call => call.url.searchParams.get("_limit")), ["5", "1"]);
});

test("parar consumo de lotes impede novas consultas", async () => {
  const fixture = setup((url, _init, _call, channel) => page(url, [deliveryFixture(deliveryId, channel)]));
  const iterator = fixture.service.getDeliveries(input);
  assert.equal(fixture.calls.length, 0);
  await iterator.next();
  await iterator.return(undefined);
  assert.equal(fixture.calls.length, 1);
});

test("página repetida e offset inconsistente impedem consultas sem progresso", async () => {
  const repeated = setup((url, _init, _call, channel) => page(url, [deliveryFixture(deliveryId, channel)]));
  const iterator = repeated.service.getDeliveries(input);
  await iterator.next();
  await assert.rejects(iterator.next(), error => error instanceof MagaluHttpError && error.code === "invalid_response");
  assert.equal(repeated.calls.length, 2);
  const invalid = setup((url, _init, _call, channel) => Response.json({
    meta: { links: { self: url.search }, page: { count: 1, offset: 3, limit: 20, max_limit: 100 } },
    results: [deliveryFixture(deliveryId, channel)],
  }));
  await assert.rejects(collect(invalid.service), error => error instanceof MagaluHttpError && error.code === "invalid_response");
});

test("payload inesperado, sem ID ou 204 não é tratado como entrega ausente", async () => {
  for (const variant of ["envelope", "id", "channel", "204"]) {
    const fixture = setup((url, _init, _call, channel) => {
      if (variant === "204") return new Response(null, { status: 204 });
      if (variant === "envelope") return Response.json({ results: [], nome: "DADO-SENSIVEL" });
      const raw = deliveryFixture(deliveryId, channel);
      return page(url, [variant === "id" ? { ...raw, id: null } : { ...raw, order: { code: deliveryOrderCode } }]);
    });
    await assert.rejects(collect(fixture.service), error => {
      assert.ok(error instanceof MagaluHttpError);
      assert.equal(error.code, "invalid_response");
      assert.equal(error.message.includes("DADO-SENSIVEL"), false);
      return true;
    });
  }
});

test("status/código opcionais não inventam dados nem bloqueiam referência válida", async () => {
  const fixture = setup((url, _init, call, channel) => page(url, call === 1 ? [{
    id: deliveryId, order: { code: deliveryOrderCode, channel: { id: channel } },
  }] : []));
  const result = (await collect(fixture.service)).flat()[0]!;
  assert.equal(result.status, null);
  assert.equal(result.externalDeliveryCode, null);
});

test("erro temporário em página posterior é limitado e mantém lote anterior entregue", async () => {
  const fixture = setup((url, _init, call, channel) => call === 1 ? page(url, [deliveryFixture(deliveryId, channel)]) : new Response(null, { status: 503 }));
  const iterator = fixture.service.getDeliveries(input);
  assert.equal((await iterator.next()).value?.[0]?.externalDeliveryId, deliveryId);
  await assert.rejects(iterator.next(), error => error instanceof MagaluHttpError && error.code === "unavailable");
  assert.deepEqual(fixture.calls.map(call => call.url.searchParams.get("_offset")), ["0", "1", "1", "1"]);
});

test("conta inexistente, de outro usuário, inativa ou de outra plataforma não acessa API", async () => {
  for (const invalid of [null, { ...account, userId: otherUserId }, { ...account, isActive: false },
    { ...account, platform: "MERCADO_LIVRE" as const }, { ...account, id: "outro-id" }]) {
    const fixture = setup(url => page(url, []), { account: invalid });
    await assert.rejects(collect(fixture.service), error => error instanceof MagaluHttpError && error.code === "invalid_account");
    assert.equal(fixture.calls.length, 0);
  }
});

test("entrada inválida falha antes de consultar conta; construtor exige usuário e lote limitado", async () => {
  const fixture = setup(url => page(url, []));
  for (const invalid of [{ ...input, externalOrderId: "" }, { ...input, marketplaceAccountId: "" },
    { ...input, externalOrderId: ".." }]) {
    await assert.rejects(fixture.service.getDeliveries(invalid).next(), error => error instanceof AppError && error.statusCode === 400);
  }
  assert.equal(fixture.lookups(), 0);
  assert.throws(() => new MagaluDeliveryService(""), error => error instanceof AppError && error.statusCode === 401);
  for (const pageSize of [0, 101, 1.5, Infinity]) {
    assert.throws(() => new MagaluDeliveryService(testUserId, { pageSize }), error => error instanceof AppError && error.statusCode === 400);
  }
});
