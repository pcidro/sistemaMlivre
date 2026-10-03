import { z } from "zod";

import { AppError } from "../../errors/AppError";
import type { MarketplaceOrder, MarketplaceOrderItem } from "../types";
import { MagaluCustomerExtractor } from "./MagaluCustomerExtractor";
import { magaluOrderSchema } from "./magaluOrder.types";
import type { MagaluOrderItem } from "./magaluOrder.types";

function invalidOrder(message: string): AppError {
  return new AppError(`A Magalu retornou ${message}`, 502);
}

function text(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function mapUnitPrice(price: MagaluOrderItem["unit_price"]): string | null {
  if (price?.value == null || price.normalizer == null || !price.currency) return null;
  if (price.currency !== "BRL") throw invalidOrder("uma moeda de item não suportada");

  const places = Math.log10(price.normalizer);
  if (!Number.isInteger(places) || 10 ** places !== price.normalizer) {
    throw invalidOrder("um normalizador de preço de item não suportado");
  }

  // Divisão decimal exata: não arredondar centavos com ponto flutuante.
  const digits = String(price.value).padStart(places + 1, "0");
  return places === 0 ? digits : `${digits.slice(0, -places)}.${digits.slice(-places)}`;
}

function mapItem(item: MagaluOrderItem): MarketplaceOrderItem {
  const name = text(item.info?.name) ?? text(item.info?.description);
  if (!name) throw invalidOrder("um item sem nome ou descrição");

  return {
    externalProductId: text(item.info?.id) ?? text(item.info?.sku),
    productName: name,
    quantity: item.quantity,
    unitPrice: mapUnitPrice(item.unit_price),
  };
}

/** Mapper puro: não consulta API, renova tokens nem persiste dados. */
export class MagaluOrderMapper {
  private readonly customerExtractor = new MagaluCustomerExtractor();

  map(payload: unknown): MarketplaceOrder {
    const parsed = magaluOrderSchema.safeParse(payload);
    if (!parsed.success) throw invalidOrder("um pedido com estrutura inválida");
    const order = parsed.data;
    const code = text(order.code);
    if (!code) throw invalidOrder("um pedido sem código");

    const purchasedAt = text(order.purchased_at);
    if (purchasedAt && !z.iso.datetime({ offset: true }).safeParse(purchasedAt).success) {
      throw invalidOrder("uma data de compra inválida");
    }

    return {
      externalOrderId: code,
      platform: "MAGALU",
      status: text(order.status),
      orderDate: purchasedAt ? new Date(purchasedAt) : null,
      customer: this.customerExtractor.extract(order),
      items: (order.deliveries ?? []).flatMap(delivery => (delivery.items ?? []).map(mapItem)),
    };
  }
}
