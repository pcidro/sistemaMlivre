import { z } from "zod";

import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import type { MarketplaceOrder, MarketplaceOrderItem } from "../types";
import { MercadoLivreTokenService } from "./mercadoLivreTokenService";

const ORDERS_SEARCH_URL = "https://api.mercadolibre.com/orders/search";
const PAGE_SIZE = 50;
const WINDOW_SIZE_HOURS = 31 * 24;
const ORDER_RETENTION_MONTHS = 12;
const MAX_REQUEST_ATTEMPTS = 5;
const MAX_RETRY_DELAY_MILLISECONDS = 30_000;

const externalIdSchema = z.union([
  z.string().min(1),
  z.number().int().positive(),
]);

const orderItemSchema = z.object({
  item: z
    .object({
      id: externalIdSchema.nullable().optional(),
      title: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  quantity: z.number().int().nonnegative(),
  unit_price: z.union([z.number().nonnegative(), z.string().min(1)]).nullable(),
});

const orderSchema = z.object({
  id: externalIdSchema,
  status: z.string().nullable().optional(),
  date_created: z.string().min(1),
  order_items: z.array(orderItemSchema).nullable().optional(),
});

const ordersPageSchema = z.object({
  paging: z.object({
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
  }),
  results: z.array(z.unknown()),
});

export interface GetMercadoLivreOrdersInput {
  marketplaceAccountId: string;
  userId: string;
  dateFrom: Date;
  dateTo: Date;
  onOrderError?: () => void;
}

interface OwnedMarketplaceAccount {
  id: string;
  externalAccountId: string;
}

interface AccessTokenProvider {
  getValidAccessToken(marketplaceAccountId: string): Promise<string>;
  refreshAccessToken(marketplaceAccountId: string): Promise<string>;
}

interface MercadoLivreOrderServiceDependencies {
  tokenService?: AccessTokenProvider;
  fetchFn?: typeof globalThis.fetch;
  findOwnedAccount?: (
    marketplaceAccountId: string,
    userId: string,
  ) => Promise<OwnedMarketplaceAccount | null>;
  sleepFn?: (milliseconds: number) => Promise<void>;
  randomFn?: () => number;
  nowFn?: () => Date;
}

function normalizeExternalId(value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new AppError(
        "O Mercado Livre retornou um identificador de pedido inválido",
        502,
      );
    }

    return String(value);
  }

  return value;
}

function normalizeOrderItem(
  rawItem: z.infer<typeof orderItemSchema>,
): MarketplaceOrderItem {
  const externalProductId = rawItem.item?.id;

  return {
    externalProductId:
      externalProductId === null || externalProductId === undefined
        ? null
        : normalizeExternalId(externalProductId),
    productName: rawItem.item?.title?.trim() || "Produto não informado",
    quantity: rawItem.quantity,
    unitPrice:
      rawItem.unit_price === null ? null : String(rawItem.unit_price),
  };
}

export function normalizeMercadoLivreOrder(
  rawOrder: z.infer<typeof orderSchema>,
): MarketplaceOrder {
  const orderDate = new Date(rawOrder.date_created);

  if (Number.isNaN(orderDate.getTime())) {
    throw new AppError(
      "O Mercado Livre retornou uma data de pedido inválida",
      502,
    );
  }

  return {
    externalOrderId: normalizeExternalId(rawOrder.id),
    platform: "MERCADO_LIVRE",
    orderDate,
    status: rawOrder.status ?? null,
    customer: {
      name: null,
      phone: null,
    },
    items: (rawOrder.order_items ?? []).map(normalizeOrderItem),
  };
}

function floorToHour(value: Date): Date {
  const result = new Date(value);
  result.setUTCMinutes(0, 0, 0);
  return result;
}

function addUtcHours(value: Date, hours: number): Date {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

function subtractUtcMonths(value: Date, months: number): Date {
  const result = new Date(value);
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class MercadoLivreOrderService {
  private readonly tokenService: AccessTokenProvider;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly findOwnedAccount: NonNullable<
    MercadoLivreOrderServiceDependencies["findOwnedAccount"]
  >;
  private readonly sleepFn: (milliseconds: number) => Promise<void>;
  private readonly randomFn: () => number;
  private readonly nowFn: () => Date;

  constructor(dependencies: MercadoLivreOrderServiceDependencies = {}) {
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
          select: {
            id: true,
            externalAccountId: true,
          },
        }));
    this.sleepFn = dependencies.sleepFn ?? defaultSleep;
    this.randomFn = dependencies.randomFn ?? Math.random;
    this.nowFn = dependencies.nowFn ?? (() => new Date());
  }

  async *getOrders(
    input: GetMercadoLivreOrdersInput,
  ): AsyncGenerator<MarketplaceOrder[]> {
    this.validatePeriod(input.dateFrom, input.dateTo);

    const account = await this.findOwnedAccount(
      input.marketplaceAccountId,
      input.userId,
    );

    if (!account) {
      throw new AppError(
        "Conta do Mercado Livre não encontrada para este usuário",
        404,
      );
    }

    const now = this.nowFn();
    const retentionStart = subtractUtcMonths(now, ORDER_RETENTION_MONTHS);
    const effectiveFrom = new Date(
      Math.max(input.dateFrom.getTime(), retentionStart.getTime()),
    );
    const effectiveTo = new Date(
      Math.min(input.dateTo.getTime(), now.getTime()),
    );

    if (effectiveFrom > effectiveTo) {
      return;
    }

    let windowStart = floorToHour(effectiveFrom);
    const finalWindowEnd = floorToHour(effectiveTo);

    while (windowStart <= finalWindowEnd) {
      const proposedEnd = addUtcHours(
        windowStart,
        WINDOW_SIZE_HOURS - 1,
      );
      const windowEnd =
        proposedEnd < finalWindowEnd ? proposedEnd : finalWindowEnd;

      yield* this.getWindowOrders(
        account,
        windowStart,
        windowEnd,
        input.dateFrom,
        input.dateTo,
        input.onOrderError,
      );

      windowStart = addUtcHours(windowEnd, 1);
    }
  }

  private async *getWindowOrders(
    account: OwnedMarketplaceAccount,
    windowStart: Date,
    windowEnd: Date,
    requestedFrom: Date,
    requestedTo: Date,
    onOrderError?: () => void,
  ): AsyncGenerator<MarketplaceOrder[]> {
    let offset = 0;
    const seenOrderIds = new Set<string>();

    while (true) {
      const page = await this.requestPage(
        account.id,
        account.externalAccountId,
        windowStart,
        windowEnd,
        offset,
      );

      const orders: MarketplaceOrder[] = [];
      for (const rawOrder of page.results) {
        let order: MarketplaceOrder;
        try {
          order = normalizeMercadoLivreOrder(orderSchema.parse(rawOrder));
        } catch {
          if (!onOrderError) {
            throw new AppError("O Mercado Livre retornou um pedido inválido", 502);
          }
          onOrderError();
          continue;
        }
        if (!order.orderDate) continue;

        const isInsideRequestedPeriod =
          order.orderDate >= requestedFrom && order.orderDate <= requestedTo;
        const isNewOrder = !seenOrderIds.has(order.externalOrderId);

        if (isInsideRequestedPeriod && isNewOrder) {
          seenOrderIds.add(order.externalOrderId);
          orders.push(order);
        }
      }

      if (orders.length > 0) {
        yield orders;
      }

      if (page.results.length === 0) {
        break;
      }

      const nextOffset = offset + page.results.length;

      if (nextOffset >= page.paging.total || nextOffset <= offset) {
        break;
      }

      offset = nextOffset;
    }
  }

  private async requestPage(
    marketplaceAccountId: string,
    sellerId: string,
    dateFrom: Date,
    dateTo: Date,
    offset: number,
  ): Promise<z.infer<typeof ordersPageSchema>> {
    let accessToken =
      await this.tokenService.getValidAccessToken(marketplaceAccountId);
    let refreshedAfterUnauthorized = false;

    for (let attempt = 0; attempt < MAX_REQUEST_ATTEMPTS; attempt += 1) {
      const url = new URL(ORDERS_SEARCH_URL);
      url.searchParams.set("seller", sellerId);
      url.searchParams.set("order.date_created.from", dateFrom.toISOString());
      url.searchParams.set("order.date_created.to", dateTo.toISOString());
      url.searchParams.set("sort", "date_asc");
      url.searchParams.set("offset", String(offset));
      url.searchParams.set("limit", String(PAGE_SIZE));

      let response: Response;

      try {
        response = await this.fetchFn(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch {
        if (attempt === MAX_REQUEST_ATTEMPTS - 1) {
          throw new AppError(
            "A API de pedidos do Mercado Livre está indisponível",
            503,
          );
        }

        await this.waitBeforeRetry(attempt);
        continue;
      }

      if (response.status === 401 && !refreshedAfterUnauthorized) {
        accessToken =
          await this.tokenService.refreshAccessToken(marketplaceAccountId);
        refreshedAfterUnauthorized = true;
        continue;
      }

      if (response.status === 429) {
        if (attempt === MAX_REQUEST_ATTEMPTS - 1) {
          throw new AppError(
            "Limite de requisições do Mercado Livre excedido. Tente novamente mais tarde",
            429,
          );
        }

        await this.waitBeforeRetry(attempt, response.headers.get("retry-after"));
        continue;
      }

      if (response.status >= 500) {
        if (attempt === MAX_REQUEST_ATTEMPTS - 1) {
          throw new AppError(
            "A API de pedidos do Mercado Livre está indisponível",
            503,
          );
        }

        await this.waitBeforeRetry(attempt);
        continue;
      }

      if (!response.ok) {
        throw new AppError(
          "Não foi possível consultar os pedidos do Mercado Livre",
          502,
        );
      }

      try {
        return ordersPageSchema.parse(await response.json());
      } catch {
        throw new AppError(
          "O Mercado Livre retornou uma lista de pedidos inválida",
          502,
        );
      }
    }

    throw new AppError(
      "A API de pedidos do Mercado Livre está indisponível",
      503,
    );
  }

  private async waitBeforeRetry(
    attempt: number,
    retryAfter: string | null = null,
  ): Promise<void> {
    const exponentialDelay = 500 * 2 ** attempt;
    const jitter = Math.floor(this.randomFn() * 250);
    const retryAfterDelay = this.parseRetryAfter(retryAfter);
    const delay = Math.min(
      Math.max(exponentialDelay + jitter, retryAfterDelay),
      MAX_RETRY_DELAY_MILLISECONDS,
    );

    await this.sleepFn(delay);
  }

  private parseRetryAfter(value: string | null): number {
    if (!value) return 0;

    const seconds = Number(value);

    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 0;

    return Math.max(0, date.getTime() - this.nowFn().getTime());
  }

  private validatePeriod(dateFrom: Date, dateTo: Date): void {
    if (
      Number.isNaN(dateFrom.getTime()) ||
      Number.isNaN(dateTo.getTime()) ||
      dateFrom > dateTo
    ) {
      throw new AppError("Período de consulta de pedidos inválido", 400);
    }
  }
}
