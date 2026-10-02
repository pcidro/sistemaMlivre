import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { AppError } from "../../errors/AppError";
import { MAX_NFE_XML_BYTES, NFeParserError, NFeParserService } from "../../services/invoices/NFeParserService";
import { MercadoLivreInvoiceService } from "./mercadoLivreInvoiceService";

const sellerId = "123456789";
const input = {
  marketplaceAccountId: "account-id",
  userId: "user-id",
  externalOrderId: "2000003508419013",
};
const xmlPath = `/users/${sellerId}/invoices/documents/xml/987654/authorized`;
const metadataUrl = `https://api.mercadolibre.com/users/${sellerId}/invoices/orders/${input.externalOrderId}`;
const xmlWithPhone = readFileSync(
  join(__dirname, "../../services/invoices/fixtures/nfe-with-phone.xml"), "utf8",
);
const xmlWithoutPhone = readFileSync(
  join(__dirname, "../../services/invoices/fixtures/nfe-without-phone.xml"), "utf8",
);

const tokenService = {
  async getValidAccessToken() { return "fake-access-token"; },
  async refreshAccessToken() { return "fake-refreshed-token"; },
};

function invoice(location: string | null = xmlPath) {
  return {
    status: "authorized",
    transaction_status: "authorized",
    attributes: { xml_location: location },
    fiscal_data: { transaction_type: "sale" },
  };
}

function json(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
}

function xmlResponse(xml = xmlWithPhone): Response {
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}

function makeService(fetchFn: typeof fetch) {
  return new MercadoLivreInvoiceService({
    tokenService,
    findOwnedAccount: async () => ({ externalAccountId: sellerId }),
    fetchFn,
    sleepFn: async () => {},
  });
}

function statusError(code: number) {
  return (error: unknown): boolean => error instanceof AppError && error.statusCode === code;
}

test("localiza nota pelo pedido da conta e retorna o XML oficial sem alteração", async () => {
  const calls: string[] = [];
  const service = new MercadoLivreInvoiceService({
    tokenService,
    findOwnedAccount: async (accountId, userId) => {
      assert.equal(accountId, input.marketplaceAccountId);
      assert.equal(userId, input.userId);
      return { externalAccountId: sellerId };
    },
    fetchFn: async (url, options) => {
      calls.push(String(url));
      assert.equal(options?.method, "GET");
      assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer fake-access-token");
      assert.equal(options?.redirect, "error");
      assert.ok(options?.signal instanceof AbortSignal);
      if (calls.length === 1) {
        assert.equal(new Headers(options?.headers).get("Accept"), "application/json");
        return json(invoice());
      }
      assert.equal(new Headers(options?.headers).get("Accept"), "application/xml, text/xml");
      return xmlResponse();
    },
  });

  assert.equal(await service.getInvoiceXml(input), xmlWithPhone);
  assert.deepEqual(calls, [metadataUrl, `https://api.mercadolibre.com${xmlPath}`]);
});

test("aceita xml_location absoluto no host oficial", async () => {
  let requests = 0;
  const service = makeService(async () => ++requests === 1
    ? json(invoice(`https://api.mercadolibre.com${xmlPath}`)) : xmlResponse());
  assert.equal(await service.getInvoiceXml(input), xmlWithPhone);
});

test("aceita status em maiúsculas e xml_location diretamente na nota", async () => {
  let requests = 0;
  const service = makeService(async () => ++requests === 1
    ? json({ status: "AUTHORIZED", xml_location: xmlPath }) : xmlResponse());
  assert.equal(await service.getInvoiceXml(input), xmlWithPhone);
});

test("consulta ausente (404 ou 204) retorna null", async () => {
  for (const status of [404, 204]) {
    const service = makeService(async () => new Response(null, { status }));
    assert.equal(await service.getInvoiceXml(input), null);
  }
});

test("XML ainda indisponível (404 ou 204) retorna null", async () => {
  for (const status of [404, 204]) {
    let requests = 0;
    const service = makeService(async () => ++requests === 1
      ? json(invoice()) : new Response(null, { status }));
    assert.equal(await service.getInvoiceXml(input), null);
  }
});

test("nota pendente, cancelada ou sem xml_location não tenta baixar XML", async () => {
  for (const payload of [
    { ...invoice(), status: "pending" },
    { ...invoice(), status: "canceled" },
    { ...invoice(), transaction_status: "canceled" },
    invoice(null),
    { status: "authorized" },
    [],
    { ...invoice(), fiscal_data: { transaction_type: "cte" } },
    { ...invoice(), fiscal_data: { transaction_type: "sale_return" } },
  ]) {
    let requests = 0;
    const service = makeService(async () => { requests++; return json(payload); });
    assert.equal(await service.getInvoiceXml(input), null);
    assert.equal(requests, 1);
  }
});

test("lista com vários documentos seleciona NF-e de venda autorizada", async () => {
  let requests = 0;
  const service = makeService(async () => ++requests === 1
    ? json([
        { ...invoice(), fiscal_data: { transaction_type: "symbolic_inbound_return" } },
        { ...invoice(), status: "canceled" },
        invoice(),
      ]) : xmlResponse());
  assert.equal(await service.getInvoiceXml(input), xmlWithPhone);
  assert.equal(requests, 2);
});

test("conta inacessível ou de outro usuário falha antes de obter tokens", async () => {
  const service = new MercadoLivreInvoiceService({
    findOwnedAccount: async () => null,
    tokenService: {
      async getValidAccessToken() { assert.fail("não deve consultar tokens"); },
      async refreshAccessToken() { assert.fail("não deve renovar tokens"); },
    },
    fetchFn: async () => { assert.fail("não deve consultar API"); },
  });
  await assert.rejects(service.getInvoiceXml(input), statusError(404));
});

test("entrada inválida é rejeitada sem consultar conta ou API", async () => {
  const service = new MercadoLivreInvoiceService({
    findOwnedAccount: async () => { assert.fail("não deve consultar conta"); },
    tokenService,
    fetchFn: async () => { assert.fail("não deve consultar API"); },
  });
  for (const value of [
    { ...input, externalOrderId: "../users" },
    { ...input, externalOrderId: "" },
    { ...input, userId: "" },
    { ...input, marketplaceAccountId: "" },
  ]) await assert.rejects(service.getInvoiceXml(value), statusError(400));
});

test("bloqueia URLs externas, outra conta, protocolo inseguro e caminhos de outros documentos", async () => {
  for (const location of [
    `https://example.com${xmlPath}`,
    `//example.com${xmlPath}`,
    `http://api.mercadolibre.com${xmlPath}`,
    `https://api.mercadolibre.com:444${xmlPath}`,
    `https://user:password@api.mercadolibre.com${xmlPath}`,
    "/users/999/invoices/documents/xml/987654/authorized",
    `/users/${sellerId}/invoices/sites/MLB/documents/danfe/987654`,
    `${xmlPath}?redirect=https://example.com`,
    `${xmlPath}#fragment`,
    "file:///private.xml",
  ]) {
    let requests = 0;
    const service = makeService(async () => { requests++; return json(invoice(location)); });
    await assert.rejects(service.getInvoiceXml(input), statusError(502));
    assert.equal(requests, 1);
  }
});

test("401 renova o token da conta uma vez, tanto na consulta quanto no download", async () => {
  for (const expiredStage of ["metadata", "xml"]) {
    let refreshes = 0;
    let expired = false;
    const service = new MercadoLivreInvoiceService({
      tokenService: {
        ...tokenService,
        async refreshAccessToken(accountId) {
          assert.equal(accountId, input.marketplaceAccountId);
          refreshes++;
          return "fake-refreshed-token";
        },
      },
      findOwnedAccount: async () => ({ externalAccountId: sellerId }),
      fetchFn: async (url, options) => {
        const stage = String(url) === metadataUrl ? "metadata" : "xml";
        if (stage === expiredStage && !expired) {
          expired = true;
          return new Response(null, { status: 401 });
        }
        const expectedToken = expired ? "fake-refreshed-token" : "fake-access-token";
        assert.equal(new Headers(options?.headers).get("Authorization"), `Bearer ${expectedToken}`);
        return stage === "metadata" ? json(invoice()) : xmlResponse();
      },
    });
    assert.equal(await service.getInvoiceXml(input), xmlWithPhone);
    assert.equal(refreshes, 1);
  }
});

test("401 persistente ou 403 produz erro explícito de autorização", async () => {
  for (const status of [401, 403]) {
    let requests = 0;
    const service = makeService(async () => { requests++; return new Response(null, { status }); });
    await assert.rejects(service.getInvoiceXml(input), statusError(403));
    assert.equal(requests, status === 401 ? 2 : 1);
  }
});

test("falha ao descartar corpo de erro não expõe erro do upstream", async () => {
  const service = makeService(async () => new Response(
    new ReadableStream({ start(controller) { controller.error(new Error("corpo privado")); } }),
    { status: 403 },
  ));
  await assert.rejects(service.getInvoiceXml(input), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 403);
    assert.ok(!error.message.includes("privado"));
    return true;
  });
});

test("respeita retry-after e limita tentativas em 429", async () => {
  const waits: number[] = [];
  let requests = 0;
  const service = new MercadoLivreInvoiceService({
    tokenService,
    findOwnedAccount: async () => ({ externalAccountId: sellerId }),
    fetchFn: async () => {
      requests++;
      return new Response(null, { status: 429, headers: { "retry-after": "2" } });
    },
    sleepFn: async (milliseconds) => { waits.push(milliseconds); },
  });
  await assert.rejects(service.getInvoiceXml(input), statusError(429));
  assert.equal(requests, 3);
  assert.deepEqual(waits, [2000, 2000]);
});

test("5xx transitório pode se recuperar na consulta e no download", async () => {
  const requests = new Map<string, number>();
  const service = makeService(async (url) => {
    const count = (requests.get(String(url)) ?? 0) + 1;
    requests.set(String(url), count);
    if (count === 1) return new Response(null, { status: 503 });
    return String(url) === metadataUrl ? json(invoice()) : xmlResponse();
  });
  assert.equal(await service.getInvoiceXml(input), xmlWithPhone);
  assert.equal(requests.get(metadataUrl), 2);
  assert.equal(requests.get(`https://api.mercadolibre.com${xmlPath}`), 2);
});

test("falha de rede, timeout e 5xx persistente ficam limitados ao pedido consultado", async () => {
  for (const failure of ["network", "timeout", "5xx"]) {
    let requests = 0;
    const service = makeService(async () => {
      requests++;
      if (failure === "network") throw new Error("detalhe privado do upstream");
      if (failure === "timeout") throw new DOMException("timeout", "TimeoutError");
      return new Response("detalhe privado do upstream", { status: 500 });
    });
    await assert.rejects(service.getInvoiceXml(input), (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 503);
      assert.ok(!error.message.includes("detalhe privado"));
      return true;
    });
    assert.equal(requests, 3);
  }
});

test("resposta inválida de metadados não é tratada como nota ausente", async () => {
  for (const response of [json(null), json({ invalid: true }), new Response("not-json")]) {
    await assert.rejects(makeService(async () => response).getInvoiceXml(input), statusError(502));
  }
});

test("HTML, PDF e corpo vazio não são aceitos como XML", async () => {
  for (const response of [
    new Response("<html>erro</html>", { headers: { "content-type": "text/html" } }),
    new Response("%PDF", { headers: { "content-type": "application/pdf" } }),
    xmlResponse("   "),
  ]) {
    let requests = 0;
    const service = makeService(async () => ++requests === 1 ? json(invoice()) : response);
    await assert.rejects(service.getInvoiceXml(input), statusError(502));
  }
});

test("limita tamanho do XML pelo cabeçalho e pelos bytes efetivamente recebidos", async () => {
  for (const response of [
    new Response("<NFe/>", {
      headers: { "content-type": "application/xml", "content-length": String(MAX_NFE_XML_BYTES + 1) },
    }),
    new Response("x".repeat(MAX_NFE_XML_BYTES + 1), { headers: { "content-type": "application/xml" } }),
  ]) {
    let requests = 0;
    const service = makeService(async () => ++requests === 1 ? json(invoice()) : response);
    await assert.rejects(service.getInvoiceXml(input), statusError(502));
  }
});

test("erro durante leitura do XML é seguro e não retorna documento parcial", async () => {
  let requests = 0;
  const service = makeService(async () => ++requests === 1 ? json(invoice()) : new Response(
    new ReadableStream({ start(controller) { controller.error(new Error("conteúdo sensível")); } }),
    { headers: { "content-type": "application/xml" } },
  ));
  await assert.rejects(service.getInvoiceXml(input), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 503);
    assert.ok(!error.message.includes("sensível"));
    return true;
  });
});

test("parser compartilhado processa XML obtido com e sem telefone", async () => {
  const parser = new NFeParserService();
  const results = [];
  for (const xml of [xmlWithPhone, xmlWithoutPhone]) {
    let requests = 0;
    const service = makeService(async () => ++requests === 1 ? json(invoice()) : xmlResponse(xml));
    const downloaded = await service.getInvoiceXml(input);
    assert.ok(downloaded);
    results.push(parser.parse(downloaded));
  }
  assert.equal(results[0]?.phone, "11999990000");
  assert.equal(results[1]?.phone, null);
  assert.equal(results[1]?.customerName, "João Fictício");
});

test("XML malformado baixado é rejeitado pelo parser independente", async () => {
  let requests = 0;
  const service = makeService(async () => ++requests === 1
    ? json(invoice()) : xmlResponse("<NFe><infNFe></NFe>"));
  const downloaded = await service.getInvoiceXml(input);
  assert.ok(downloaded);
  assert.throws(() => new NFeParserService().parse(downloaded), NFeParserError);
});
