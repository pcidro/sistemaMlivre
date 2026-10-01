import assert from "node:assert/strict";
import { test } from "node:test";

import type { MarketplaceOrder } from "../types";
import { MercadoLivreRecipientService } from "./mercadoLivreRecipientService";

const order: MarketplaceOrder = {
  externalOrderId: "2000003508419013",
  platform: "MERCADO_LIVRE",
  orderDate: new Date("2026-09-15T12:00:00.000Z"),
  status: "paid",
  customer: { name: null, phone: null },
  items: [],
};

const tokenService = {
  async getValidAccessToken() {
    return "access-token";
  },
  async refreshAccessToken() {
    return "refreshed-access-token";
  },
};

test("prioriza nome e telefone do destinatário do envio", async () => {
  const requestedUrls: string[] = [];
  const mockFetch = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url.includes("/orders/")) {
      return new Response(
        JSON.stringify({
          buyer: {
            first_name: "Maria",
            last_name: "Compradora",
            phone: { area_code: "11", number: "3333-4444" },
          },
          shipping: { id: 46803546483 },
        }),
        { status: 200 },
      );
    }

    const headers = new Headers(init?.headers);
    assert.equal(headers.get("X-Api-Version"), "2");
    assert.equal(headers.get("x-format-new"), "true");

    return new Response(
      JSON.stringify({
        destination: {
          receiver_name: "  Maria   da Silva  ",
          receiver_phone: "+55 (11) 99999-9999",
        },
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  const service = new MercadoLivreRecipientService({
    tokenService,
    fetchFn: mockFetch,
  });

  assert.deepEqual(await service.getRecipient("account-id", order), {
    name: "Maria da Silva",
    phone: "5511999999999",
  });
  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[1] ?? "", /views=destination/);
});

test("localiza explicitamente o envio forward quando o pedido não traz shipping.id", async () => {
  const requestedShipmentIds: string[] = [];
  const mockFetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));

    if (url.pathname.endsWith(`/orders/${order.externalOrderId}`)) {
      return new Response(
        JSON.stringify({
          buyer: { first_name: "João", last_name: "Santos" },
          shipping: null,
        }),
        { status: 200 },
      );
    }

    if (url.pathname.endsWith("/shipments")) {
      assert.equal(url.searchParams.get("hosted"), "true");
      return new Response(
        JSON.stringify([
          { id: 999, type: "return" },
          { id: 123, type: "forward" },
        ]),
        { status: 200 },
      );
    }

    requestedShipmentIds.push(url.pathname);
    return new Response(
      JSON.stringify({
        receiver_address: {
          receiver_name: null,
          receiver_phone: "11987654321",
        },
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  const service = new MercadoLivreRecipientService({
    tokenService,
    fetchFn: mockFetch,
  });

  assert.deepEqual(await service.getRecipient("account-id", order), {
    name: "João Santos",
    phone: "5511987654321",
  });
  assert.deepEqual(requestedShipmentIds, ["/shipments/123"]);
});

test("retorna null para telefone ausente sem inventar informação", async () => {
  let requests = 0;
  const mockFetch = (async () => {
    requests += 1;

    if (requests === 1) {
      return new Response(
        JSON.stringify({
          buyer: {},
          shipping: null,
        }),
        { status: 200 },
      );
    }

    return new Response(null, { status: 204 });
  }) as typeof fetch;

  const service = new MercadoLivreRecipientService({
    tokenService,
    fetchFn: mockFetch,
  });

  assert.deepEqual(await service.getRecipient("account-id", order), {
    name: null,
    phone: null,
  });
});
