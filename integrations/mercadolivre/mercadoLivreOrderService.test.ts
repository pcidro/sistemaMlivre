import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import type { MarketplaceOrder } from "../types";
import { MercadoLivreOrderService } from "./mercadoLivreOrderService";

const MARKETPLACE_ACCOUNT_ID = "marketplace-account-id";
const USER_ID = "user-id";
const NOW = new Date("2026-10-01T12:00:00.000Z");

const tokenService = {
  async getValidAccessToken() {
    return "access-token";
  },
  async refreshAccessToken() {
    return "refreshed-access-token";
  },
};

const findOwnedAccount = async () => ({
  id: MARKETPLACE_ACCOUNT_ID,
  externalAccountId: "123456789",
});

test("isola pedidos malformados, preserva válidos da mesma página e continua paginação", async () => {
  let failures = 0;
  let requests = 0;
  const service = new MercadoLivreOrderService({
    tokenService, findOwnedAccount, nowFn: () => NOW,
    fetchFn: async () => {
      const results = ++requests === 1 ? [
        { id: "1", date_created: "2026-09-10T00:00:00Z", order_items: [] },
        { id: "2", date_created: "data inválida", order_items: [] },
        { id: "3", date_created: "2026-09-10T00:00:00Z", order_items: [{ quantity: -1 }] },
      ] : [{ id: "4", date_created: "2026-09-11T00:00:00Z", order_items: [] }];
      return new Response(JSON.stringify({ results, paging: { total: 4, offset: requests === 1 ? 0 : 3, limit: 50 } }));
    },
  });
  const ids: string[] = [];
  for await (const page of service.getOrders({
    marketplaceAccountId: MARKETPLACE_ACCOUNT_ID, userId: USER_ID,
    dateFrom: new Date("2026-09-01T00:00:00Z"), dateTo: new Date("2026-09-30T23:59:59Z"),
    onOrderError: () => { failures++; },
  })) ids.push(...page.map((order) => order.externalOrderId));
  assert.deepEqual(ids, ["1", "4"]);
  assert.equal(failures, 2);
  assert.equal(requests, 2);
});

async function collectOrders(
  service: MercadoLivreOrderService,
  dateFrom = new Date("2026-09-01T00:00:00.000Z"),
  dateTo = new Date("2026-09-30T23:59:59.999Z"),
): Promise<MarketplaceOrder[]> {
  const orders: MarketplaceOrder[] = [];

  for await (const batch of service.getOrders({
    marketplaceAccountId: MARKETPLACE_ACCOUNT_ID,
    userId: USER_ID,
    dateFrom,
    dateTo,
  })) {
    orders.push(...batch);
  }

  return orders;
}

test("pagina e normaliza pedidos e produtos sem acumular páginas", async () => {
  const requestedOffsets: string[] = [];
  const mockFetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    const offset = url.searchParams.get("offset") ?? "";
    requestedOffsets.push(offset);

    const results =
      offset === "0"
        ? [
            {
              id: 1001,
              status: "paid",
              date_created: "2026-09-10T10:30:00.000-03:00",
              order_items: [
                {
                  item: { id: "MLB123", title: "Produto X" },
                  quantity: 2,
                  unit_price: 19.9,
                },
              ],
            },
            {
              id: 1002,
              status: null,
              date_created: "2026-09-11T11:00:00.000-03:00",
              order_items: [],
            },
          ]
        : [
            {
              id: "1003",
              status: "confirmed",
              date_created: "2026-09-12T12:00:00.000-03:00",
              order_items: null,
            },
          ];

    return new Response(
      JSON.stringify({
        paging: { total: 3, offset: Number(offset), limit: 2 },
        results,
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  const service = new MercadoLivreOrderService({
    tokenService,
    fetchFn: mockFetch,
    findOwnedAccount,
    nowFn: () => NOW,
  });
  const orders = await collectOrders(service);

  assert.deepEqual(requestedOffsets, ["0", "2"]);
  assert.equal(orders.length, 3);
  assert.deepEqual(orders[0]?.items, [
    {
      externalProductId: "MLB123",
      productName: "Produto X",
      quantity: 2,
      unitPrice: "19.9",
    },
  ]);
  assert.deepEqual(orders[1]?.items, []);
  assert.deepEqual(orders[2]?.items, []);
});

test("recusa conta que não pertence ao usuário", async () => {
  let tokenWasRequested = false;
  const service = new MercadoLivreOrderService({
    tokenService: {
      async getValidAccessToken() {
        tokenWasRequested = true;
        return "access-token";
      },
      async refreshAccessToken() {
        return "access-token";
      },
    },
    findOwnedAccount: async () => null,
    nowFn: () => NOW,
  });

  await assert.rejects(() => collectOrders(service), AppError);
  assert.equal(tokenWasRequested, false);
});

test("respeita Retry-After após rate limit e tenta novamente", async () => {
  let requests = 0;
  const delays: number[] = [];
  const mockFetch = (async () => {
    requests += 1;

    if (requests === 1) {
      return new Response(null, {
        status: 429,
        headers: { "Retry-After": "2" },
      });
    }

    return new Response(
      JSON.stringify({
        paging: { total: 0, offset: 0, limit: 50 },
        results: [],
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  const service = new MercadoLivreOrderService({
    tokenService,
    fetchFn: mockFetch,
    findOwnedAccount,
    sleepFn: async (milliseconds) => {
      delays.push(milliseconds);
    },
    randomFn: () => 0,
    nowFn: () => NOW,
  });

  assert.deepEqual(await collectOrders(service), []);
  assert.equal(requests, 2);
  assert.deepEqual(delays, [2000]);
});

test("falha de forma controlada quando a API permanece indisponível", async () => {
  let requests = 0;
  const service = new MercadoLivreOrderService({
    tokenService,
    fetchFn: (async () => {
      requests += 1;
      return new Response(null, { status: 503 });
    }) as typeof fetch,
    findOwnedAccount,
    sleepFn: async () => undefined,
    randomFn: () => 0,
    nowFn: () => NOW,
  });

  await assert.rejects(
    () => collectOrders(service),
    (error: unknown) =>
      error instanceof AppError && error.statusCode === 503,
  );
  assert.equal(requests, 5);
});

test("divide períodos extensos em janelas sequenciais", async () => {
  const windows: Array<{ from: string; to: string }> = [];
  const mockFetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    windows.push({
      from: url.searchParams.get("order.date_created.from") ?? "",
      to: url.searchParams.get("order.date_created.to") ?? "",
    });

    return new Response(
      JSON.stringify({
        paging: { total: 0, offset: 0, limit: 50 },
        results: [],
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  const service = new MercadoLivreOrderService({
    tokenService,
    fetchFn: mockFetch,
    findOwnedAccount,
    nowFn: () => NOW,
  });

  await collectOrders(
    service,
    new Date("2026-08-01T00:00:00.000Z"),
    new Date("2026-09-30T23:59:59.999Z"),
  );

  assert.equal(windows.length, 2);
  assert.equal(windows[0]?.from, "2026-08-01T00:00:00.000Z");
  assert.equal(windows[0]?.to, "2026-08-31T23:00:00.000Z");
  assert.equal(windows[1]?.from, "2026-09-01T00:00:00.000Z");
});
