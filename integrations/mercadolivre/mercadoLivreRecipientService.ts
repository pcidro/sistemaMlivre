import { z } from "zod";

import { AppError } from "../../errors/AppError";
import { normalizePhone } from "../../utils/normalizePhone";
import { normalizeCustomerDocument } from "../../utils/normalizeDocument";
import type { NormalizedDocument } from "../../utils/normalizeDocument";
import type { MarketplaceCustomer, MarketplaceOrder } from "../types";
import { MercadoLivreTokenService } from "./mercadoLivreTokenService";

const API_BASE_URL = "https://api.mercadolibre.com";

const externalIdSchema = z.union([
  z.string().min(1),
  z.number().int().positive(),
]);

const phonePartSchema = z.union([z.string(), z.number()]).nullable().optional();

const phoneSchema = z
  .union([
    z.string(),
    z.object({
      area_code: phonePartSchema,
      number: phonePartSchema,
    }),
  ])
  .nullable()
  .optional();

const orderDetailsSchema = z.object({
  buyer: z
    .object({
      first_name: z.string().nullable().optional(),
      last_name: z.string().nullable().optional(),
      phone: phoneSchema,
      alternative_phone: phoneSchema,
      billing_info: z.object({ id: externalIdSchema.nullable().optional() }).nullable().optional(),
    })
    .nullable()
    .optional(),
  shipping: z
    .object({
      id: externalIdSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
});

const shipmentReferenceSchema = z.object({
  id: externalIdSchema,
  type: z.string().nullable().optional(),
});

const recipientFieldsSchema = z.object({
  receiver_name: z.string().nullable().optional(),
  receiver_phone: z.string().nullable().optional(),
});

const shipmentSchema = z.object({
  receiver_name: z.string().nullable().optional(),
  receiver_phone: z.string().nullable().optional(),
  receiver_address: recipientFieldsSchema.nullable().optional(),
  destination: recipientFieldsSchema.nullable().optional(),
});

const billingIdentificationSchema = z.object({
  buyer: z.object({
    billing_info: z.object({
      identification: z.object({
        type: z.string().nullable().optional(),
        number: z.string().nullable().optional(),
      }).nullable().optional(),
    }).nullable().optional(),
  }).nullable().optional(),
});

const receiverDocumentSchema = z.object({
  receiver: z.object({
    document: z.object({
      id: z.string().nullable().optional(),
      value: z.string().nullable().optional(),
    }).nullable().optional(),
  }).nullable().optional(),
});

function officialDocument(value?: string | null, type?: string | null): NormalizedDocument {
  return type === "CPF" || type === "CNPJ"
    ? normalizeCustomerDocument(value, type)
    : normalizeCustomerDocument(null);
}

interface AccessTokenProvider {
  getValidAccessToken(marketplaceAccountId: string): Promise<string>;
  refreshAccessToken(marketplaceAccountId: string): Promise<string>;
}

interface MercadoLivreRecipientServiceDependencies {
  tokenService?: AccessTokenProvider;
  fetchFn?: typeof globalThis.fetch;
  sleepFn?: (milliseconds: number) => Promise<void>;
}

interface RequestContext {
  marketplaceAccountId: string;
  accessToken: string;
}

function normalizeName(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function externalIdToString(value: string | number): string {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new AppError(
      "O Mercado Livre retornou um identificador inválido",
      502,
    );
  }

  return String(value);
}

function phoneValue(
  value: z.infer<typeof phoneSchema>,
): string | null {
  if (typeof value === "string") {
    return normalizePhone(value);
  }

  if (!value) return null;

  const areaCode = value.area_code ?? "";
  const number = value.number ?? "";

  return normalizePhone(`${areaCode}${number}`);
}

function buyerData(
  buyer: z.infer<typeof orderDetailsSchema>["buyer"],
): MarketplaceCustomer {
  if (!buyer) return { name: null, phone: null };

  return {
    name: normalizeName(
      [buyer.first_name, buyer.last_name].filter(Boolean).join(" "),
    ),
    phone: phoneValue(buyer.phone) ?? phoneValue(buyer.alternative_phone),
  };
}

function shipmentRecipientData(
  shipment: z.infer<typeof shipmentSchema>,
): MarketplaceCustomer {
  const source = shipment.destination ?? shipment.receiver_address;

  return {
    name: normalizeName(source?.receiver_name ?? shipment.receiver_name),
    phone: normalizePhone(
      source?.receiver_phone ?? shipment.receiver_phone ?? null,
    ),
  };
}

export class MercadoLivreRecipientService {
  private readonly tokenService: AccessTokenProvider;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly sleepFn: (milliseconds: number) => Promise<void>;

  constructor(dependencies: MercadoLivreRecipientServiceDependencies = {}) {
    this.tokenService =
      dependencies.tokenService ?? new MercadoLivreTokenService();
    this.fetchFn = dependencies.fetchFn ?? globalThis.fetch;
    this.sleepFn = dependencies.sleepFn ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async getRecipient(
    marketplaceAccountId: string,
    order: Pick<MarketplaceOrder, "externalOrderId" | "customer">,
  ): Promise<MarketplaceCustomer> {
    const context: RequestContext = {
      marketplaceAccountId,
      accessToken:
        await this.tokenService.getValidAccessToken(marketplaceAccountId),
    };

    const detailsPayload = await this.requestJson(
      `${API_BASE_URL}/orders/${encodeURIComponent(order.externalOrderId)}`,
      context,
    );
    const detailsResult = orderDetailsSchema.safeParse(detailsPayload);

    if (!detailsResult.success) {
      throw new AppError(
        "O Mercado Livre retornou dados inválidos para o pedido",
        502,
      );
    }

    const orderBuyer = buyerData(detailsResult.data.buyer);
    const fallback: MarketplaceCustomer = {
      name: orderBuyer.name ?? normalizeName(order.customer.name),
      phone: orderBuyer.phone ?? normalizePhone(order.customer.phone),
      ...normalizeCustomerDocument(order.customer.document, order.customer.documentType),
    };

    // Fluxo vigente: obter o ID no pedido antes de consultar os dados de faturamento.
    const billingId = detailsResult.data.buyer?.billing_info?.id;
    if (billingId !== null && billingId !== undefined) {
      const payload = await this.requestJson(
        `${API_BASE_URL}/orders/billing-info/MLB/${encodeURIComponent(externalIdToString(billingId))}`,
        context, {}, true,
      );
      const parsed = billingIdentificationSchema.safeParse(payload);
      const identification = parsed.success ? parsed.data.buyer?.billing_info?.identification : null;
      const document = officialDocument(identification?.number, identification?.type);
      if (document.document !== null) Object.assign(fallback, document);
    }

    const shipmentId =
      detailsResult.data.shipping?.id === null ||
      detailsResult.data.shipping?.id === undefined
        ? await this.findForwardShipmentId(order.externalOrderId, context)
        : externalIdToString(detailsResult.data.shipping.id);

    if (!shipmentId) return fallback;

    if (!fallback.document) {
      const payload = await this.requestJson(
        `${API_BASE_URL}/shipments/${encodeURIComponent(shipmentId)}/billing_info`,
        context, {}, true,
      );
      const parsed = receiverDocumentSchema.safeParse(payload);
      const document = parsed.success ? parsed.data.receiver?.document : null;
      Object.assign(fallback, officialDocument(document?.value, document?.id));
    }

    const shipmentUrl = new URL(`${API_BASE_URL}/shipments/${shipmentId}`);
    shipmentUrl.searchParams.set("views", "destination");

    const shipmentPayload = await this.requestJson(shipmentUrl, context, {
      "X-Api-Version": "2",
      "x-format-new": "true",
    });

    if (shipmentPayload === null) return fallback;

    const shipmentResult = shipmentSchema.safeParse(shipmentPayload);

    if (!shipmentResult.success) {
      throw new AppError(
        "O Mercado Livre retornou dados inválidos para o envio",
        502,
      );
    }

    const recipient = shipmentRecipientData(shipmentResult.data);

    return {
      name: recipient.name ?? fallback.name,
      phone: recipient.phone ?? fallback.phone,
      document: fallback.document ?? null,
      documentType: fallback.documentType ?? null,
    };
  }

  private async findForwardShipmentId(
    orderId: string,
    context: RequestContext,
  ): Promise<string | null> {
    const url = new URL(
      `${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/shipments`,
    );
    url.searchParams.set("hosted", "true");

    const payload = await this.requestJson(url, context, {
      "X-New-Domain": "true",
    });

    if (payload === null) return null;

    const listResult = z.array(shipmentReferenceSchema).safeParse(payload);

    if (listResult.success) {
      const forwardShipment = listResult.data.find(
        (shipment) => shipment.type === "forward",
      );

      return forwardShipment
        ? externalIdToString(forwardShipment.id)
        : null;
    }

    const singleResult = shipmentReferenceSchema.safeParse(payload);

    if (
      singleResult.success &&
      (!singleResult.data.type || singleResult.data.type === "forward")
    ) {
      return externalIdToString(singleResult.data.id);
    }

    throw new AppError(
      "O Mercado Livre retornou uma lista de envios inválida",
      502,
    );
  }

  private async requestJson(
    input: string | URL,
    context: RequestContext,
    extraHeaders: Record<string, string> = {},
    optionalDocument = false,
  ): Promise<unknown | null> {
    let refreshedAfterUnauthorized = false;
    let rateLimitRetries = 0;

    while (true) {
      let response: Response;

      try {
        response = await this.fetchFn(input, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${context.accessToken}`,
            ...extraHeaders,
          },
        });
      } catch {
        throw new AppError(
          "A API do Mercado Livre está indisponível",
          503,
        );
      }

      if (response.status === 401 && !refreshedAfterUnauthorized) {
        context.accessToken = await this.tokenService.refreshAccessToken(
          context.marketplaceAccountId,
        );
        refreshedAfterUnauthorized = true;
        continue;
      }

      if (response.status === 204 || response.status === 404 || optionalDocument && response.status === 403) {
        return null;
      }

      if (response.status === 429) {
        if (rateLimitRetries < 2) {
          const header = response.headers.get("retry-after");
          const seconds = header === null ? NaN : Number(header);
          const fromHeader = Number.isFinite(seconds) && seconds >= 0
            ? seconds * 1000
            : Math.max(0, Date.parse(header ?? "") - Date.now()) || 0;
          await this.sleepFn(Math.max(500 * 2 ** rateLimitRetries, fromHeader));
          rateLimitRetries++;
          continue;
        }
        throw new AppError(
          "Limite de requisições do Mercado Livre excedido. Tente novamente mais tarde",
          429,
        );
      }

      if (response.status >= 500) {
        throw new AppError(
          "A API do Mercado Livre está indisponível",
          503,
        );
      }

      if (!response.ok) {
        throw new AppError(
          "Não foi possível consultar os dados do destinatário no Mercado Livre",
          502,
        );
      }

      try {
        return await response.json();
      } catch {
        throw new AppError(
          "O Mercado Livre retornou uma resposta inválida",
          502,
        );
      }
    }
  }
}
