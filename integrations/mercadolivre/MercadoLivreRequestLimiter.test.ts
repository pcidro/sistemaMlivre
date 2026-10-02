import assert from "node:assert/strict";
import { test } from "node:test";
import { MercadoLivreRequestLimiter } from "./MercadoLivreRequestLimiter";

function setup(header?: string) {
  let now = Date.parse("2026-10-01T12:00:00Z");
  const starts: number[] = [];
  const sleeps: number[] = [];
  const limiter = new MercadoLivreRequestLimiter({
    nowFn: () => now,
    sleepFn: async (ms) => { sleeps.push(ms); now += ms; },
    fetchFn: async (_input, init) => {
      starts.push(now);
      assert.ok(init?.signal);
      assert.equal(init?.redirect, "error");
      return starts.length === 1 && header !== undefined
        ? new Response(null, { status: 429, headers: header ? { "Retry-After": header } : {} })
        : new Response(null, { status: 204 });
    },
  });
  return { limiter, starts, sleeps };
}

test("espaça chamadas simultâneas por no mínimo 250ms", async () => {
  const { limiter, starts } = setup();
  await Promise.all(Array.from({ length: 5 }, () => limiter.fetch("https://api.mercadolibre.com/orders/1")));
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i]! - starts[i - 1]! >= 250);
});

for (const header of ["60", "Thu, 01 Oct 2026 12:01:00 GMT"]) {
  test(`compartilha pausa 429 e respeita Retry-After superior a 30s (${header})`, async () => {
    const { limiter, starts, sleeps } = setup(header);
    await limiter.fetch("https://api.mercadolibre.com/orders/search");
    await limiter.fetch("https://api.mercadolibre.com/shipments/1");
    assert.ok(starts[1]! - starts[0]! >= 60_000);
    assert.deepEqual(sleeps, [30_000, 30_000]);
  });
}

test("429 sem Retry-After impõe uma pausa mínima compartilhada", async () => {
  const { limiter, starts } = setup("");
  await limiter.fetch("https://api.mercadolibre.com/orders/1");
  await limiter.fetch("https://api.mercadolibre.com/orders/2");
  assert.ok(starts[1]! - starts[0]! >= 2000);
});

test("uma falha de rede não trava a fila de requisições", async () => {
  let calls = 0;
  const limiter = new MercadoLivreRequestLimiter({
    intervalMs: 0,
    fetchFn: async () => {
      if (++calls === 1) throw new Error("falha");
      return new Response(null, { status: 204 });
    },
  });
  await assert.rejects(limiter.fetch("https://api.mercadolibre.com/orders/1"));
  assert.equal((await limiter.fetch("https://api.mercadolibre.com/orders/2")).status, 204);
});
