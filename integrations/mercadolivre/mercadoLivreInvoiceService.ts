import { Buffer } from "node:buffer";
import { z } from "zod";

import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { MAX_NFE_XML_BYTES } from "../../services/invoices/NFeParserService";
import { MercadoLivreTokenService } from "./mercadoLivreTokenService";

const API_BASE_URL = "https://api.mercadolibre.com";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_TRANSIENT_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 30_000;

const inputSchema = z.object({
  marketplaceAccountId: z.string().min(1),
  userId: z.string().min(1),
  externalOrderId: z.string().regex(/^\d+$/),
});

const invoiceSchema = z.object({
  status: z.string(),
  transaction_status: z.string().nullable().optional(),
  attributes: z
    .object({ xml_location: z.string().nullable().optional() })
    .nullable()
    .optional(),
  xml_location: z.string().nullable().optional(),
  fiscal_data: z
    .object({ transaction_type: z.string().nullable().optional() })
    .nullable()
    .optional(),
});

const invoiceResponseSchema = z.union([invoiceSchema, z.array(invoiceSchema)]);

export interface GetMercadoLivreInvoiceInput {
  marketplaceAccountId: string;
  userId: string;
  externalOrderId: string;
}

interface AccessTokenProvider {
  getValidAccessToken(marketplaceAccountId: string): Promise<string>;
  refreshAccessToken(marketplaceAccountId: string): Promise<string>;
}

interface MercadoLivreInvoiceServiceDependencies {
  tokenService?: AccessTokenProvider;
  fetchFn?: typeof globalThis.fetch;
  findOwnedAccount?: (
    marketplaceAccountId: string,
    userId: string,
  ) => Promise<{ externalAccountId: string } | null>;
  sleepFn?: (milliseconds: number) => Promise<void>;
}

interface RequestContext {
  marketplaceAccountId: string;
  accessToken: string;
}

/** Consulta apenas NF-e de venda; o XML retornado é transitório e não é persistido. */
export class MercadoLivreInvoiceService {
  private readonly tokenService: AccessTokenProvider;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly findOwnedAccount: NonNullable<
    MercadoLivreInvoiceServiceDependencies["findOwnedAccount"]
  >;
  private readonly sleepFn: (milliseconds: number) => Promise<void>;

  constructor(dependencies: MercadoLivreInvoiceServiceDependencies = {}) {
    this.tokenService =
      dependencies.tokenService ?? new MercadoLivreTokenService();
    this.fetchFn = dependencies.fetchFn ?? globalThis.fetch;
    this.findOwnedAccount =
      dependencies.findOwnedAccount ??
      ((marketplaceAccountId, userId) =>
        prisma.marketplaceAccount.findFirst({
          where: {
            id: marketplaceAccountId,
            userId,
            platform: "MERCADO_LIVRE",
            isActive: true,
          },
          select: { externalAccountId: true },
        }));
    this.sleepFn =
      dependencies.sleepFn ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async getInvoiceXml(input: GetMercadoLivreInvoiceInput): Promise<string | null> {
    if (!inputSchema.safeParse(input).success) {
      throw new AppError("Dados de consulta da NF-e inválidos", 400);
    }

    const account = await this.findOwnedAccount(
      input.marketplaceAccountId,
      input.userId,
    );
    if (!account) {
      throw new AppError("Conta do Mercado Livre não encontrada ou inativa", 404);
    }
    if (!/^\d+$/.test(account.externalAccountId)) {
      throw new AppError("Identificador da conta do Mercado Livre inválido", 502);
    }

    const context: RequestContext = {
      marketplaceAccountId: input.marketplaceAccountId,
      accessToken: await this.tokenService.getValidAccessToken(
        input.marketplaceAccountId,
      ),
    };
    const url = new URL(
      `/users/${account.externalAccountId}/invoices/orders/${input.externalOrderId}`,
      API_BASE_URL,
    );
    const response = await this.request(url, context, "application/json");
    if (!response) return null;

    let invoices: z.infer<typeof invoiceSchema>[];
    try {
      const payload = invoiceResponseSchema.parse(await response.json());
      invoices = Array.isArray(payload) ? payload : [payload];
    } catch {
      throw new AppError(
        "O Mercado Livre retornou dados inválidos para a NF-e",
        502,
      );
    }

    for (const invoice of invoices) {
      const type = invoice.fiscal_data?.transaction_type?.toLowerCase();
      if (type && type !== "sale") continue;
      if (invoice.status.toLowerCase() !== "authorized") continue;
      if (
        invoice.transaction_status &&
        invoice.transaction_status.toLowerCase() !== "authorized"
      ) {
        continue;
      }

      const location = invoice.attributes?.xml_location ?? invoice.xml_location;
      if (!location) continue;

      const xmlUrl = this.getOfficialXmlUrl(location, account.externalAccountId);
      const xmlResponse = await this.request(
        xmlUrl,
        context,
        "application/xml, text/xml",
      );
      if (!xmlResponse) continue;

      return this.readXml(xmlResponse);
    }

    return null;
  }

  private getOfficialXmlUrl(location: string, sellerId: string): URL {
    let url: URL;
    try {
      url = new URL(location, API_BASE_URL);
    } catch {
      throw new AppError(
        "O Mercado Livre retornou uma localização de XML inválida",
        502,
      );
    }

    // O bearer token só pode ir ao endpoint oficial de XML da própria conta.
    const expectedPath = new RegExp(
      `^/users/${sellerId}/invoices/documents/xml/\\d+/authorized$`,
    );
    if (
      url.origin !== API_BASE_URL ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !expectedPath.test(url.pathname)
    ) {
      throw new AppError(
        "O Mercado Livre retornou uma localização de XML inválida",
        502,
      );
    }

    return url;
  }

  private async request(
    url: URL,
    context: RequestContext,
    accept: string,
  ): Promise<Response | null> {
    let refreshed = false;

    for (let attempt = 0; attempt < MAX_TRANSIENT_ATTEMPTS; ) {
      let response: Response;
      try {
        response = await this.fetchFn(url, {
          method: "GET",
          headers: {
            Accept: accept,
            Authorization: `Bearer ${context.accessToken}`,
          },
          redirect: "error",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        attempt += 1;
        if (attempt === MAX_TRANSIENT_ATTEMPTS) {
          throw new AppError(
            "A API de notas fiscais do Mercado Livre está indisponível",
            503,
          );
        }
        await this.waitBeforeRetry(attempt);
        continue;
      }

      if (response.status === 401 && !refreshed) {
        await this.discardResponse(response);
        context.accessToken = await this.tokenService.refreshAccessToken(
          context.marketplaceAccountId,
        );
        refreshed = true;
        continue;
      }

      if (response.status === 204 || response.status === 404) {
        await this.discardResponse(response);
        return null;
      }

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get("retry-after");
        await this.discardResponse(response);
        attempt += 1;
        if (attempt === MAX_TRANSIENT_ATTEMPTS) {
          throw new AppError(
            response.status === 429
              ? "Limite de consultas de notas fiscais excedido. Tente novamente mais tarde"
              : "A API de notas fiscais do Mercado Livre está indisponível",
            response.status === 429 ? 429 : 503,
          );
        }
        await this.waitBeforeRetry(attempt, retryAfter);
        continue;
      }

      if (!response.ok) {
        await this.discardResponse(response);
        throw new AppError(
          response.status === 401 || response.status === 403
            ? "A conta não possui autorização para consultar esta NF-e"
            : "Não foi possível consultar a NF-e no Mercado Livre",
          response.status === 401 || response.status === 403 ? 403 : 502,
        );
      }

      return response;
    }

    throw new AppError(
      "A API de notas fiscais do Mercado Livre está indisponível",
      503,
    );
  }

  private async discardResponse(response: Response): Promise<void> {
    try {
      await response.body?.cancel();
    } catch {
      // Uma falha ao descartar o corpo não deve substituir o erro seguro da API.
    }
  }

  private async readXml(response: Response): Promise<string> {
    const contentType = response.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();
    if (
      contentType &&
      !["application/xml", "text/xml", "application/octet-stream"].includes(contentType)
    ) {
      await this.discardResponse(response);
      throw new AppError("O Mercado Livre retornou um documento que não é XML", 502);
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (contentLength > MAX_NFE_XML_BYTES) {
      await this.discardResponse(response);
      throw new AppError("XML da NF-e excede o limite de tamanho", 502);
    }
    if (!response.body) {
      throw new AppError("O Mercado Livre retornou um XML vazio", 502);
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_NFE_XML_BYTES) {
          await reader.cancel();
          throw new AppError("XML da NF-e excede o limite de tamanho", 502);
        }
        chunks.push(value);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "Não foi possível obter o XML da NF-e no Mercado Livre",
        503,
      );
    } finally {
      reader.releaseLock();
    }

    const xml = Buffer.concat(chunks, bytes).toString("utf8");
    if (!xml.trim()) throw new AppError("O Mercado Livre retornou um XML vazio", 502);
    return xml;
  }

  private async waitBeforeRetry(
    attempt: number,
    retryAfter: string | null = null,
  ): Promise<void> {
    const seconds = retryAfter === null ? NaN : Number(retryAfter);
    const retryAfterMs = Number.isFinite(seconds)
      ? Math.max(0, seconds * 1000)
      : Math.max(0, Date.parse(retryAfter ?? "") - Date.now()) || 0;
    await this.sleepFn(
      Math.min(
        Math.max(500 * 2 ** (attempt - 1), retryAfterMs),
        MAX_RETRY_DELAY_MS,
      ),
    );
  }
}
