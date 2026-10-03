import { z } from "zod";

import { AppError } from "../../errors/AppError";
import { mergeCustomerData, normalizeCustomerData } from "../../services/customers/customerData";
import type { NormalizedCustomerData } from "../../services/customers/customerData";
import type { MarketplaceOrder } from "../types";
import { MagaluDeliveryService } from "./MagaluDeliveryService";
import { MagaluHttpError } from "./magaluHttpError";
import { MagaluInvoiceService } from "./MagaluInvoiceService";
import type { MagaluProcessedInvoice } from "./magaluInvoice.types";
import { magaluTokenStorage } from "./magaluTokenStorage";
import type { MagaluTokenAccount } from "./magaluTokenStorage";

const inputSchema = z.object({
  marketplaceAccountId: z.string().trim().min(1),
  order: z.object({
    platform: z.literal("MAGALU"),
    externalOrderId: z.string().trim().min(1).max(200).refine(code => code !== "." && code !== ".."),
    customer: z.object({
      name: z.string().nullable(), phone: z.string().nullable(),
      document: z.string().nullish(), documentType: z.enum(["CPF", "CNPJ"]).nullish(),
    }),
  }),
});

export interface GetMagaluCustomerInput {
  marketplaceAccountId: string;
  /** Pedido normalizado pelo mapper; tipos crus da Magalu não saem da integração. */
  order: MarketplaceOrder;
  onFallbackError?: (error: MagaluHttpError) => void;
}

export interface MagaluCustomerData {
  customer: NormalizedCustomerData;
  /** Notas selecionadas e conferidas durante o fallback, sem XML. */
  invoices: MagaluProcessedInvoice[];
}

interface MagaluCustomerServiceDependencies {
  findAccount?: (id: string) => Promise<MagaluTokenAccount | null>;
  deliveries?: Pick<MagaluDeliveryService, "getDeliveries">;
  invoices?: Pick<MagaluInvoiceService, "getInvoice">;
}

function complete(customer: NormalizedCustomerData): boolean {
  return customer.name !== null && customer.phone !== null && customer.document !== null;
}

/** Pedido primeiro; consultas fiscais somente para completar campos ausentes. */
export class MagaluCustomerService {
  private readonly findAccount: NonNullable<MagaluCustomerServiceDependencies["findAccount"]>;
  private readonly deliveries: Pick<MagaluDeliveryService, "getDeliveries">;
  private readonly invoices: Pick<MagaluInvoiceService, "getInvoice">;

  constructor(private readonly userId: string, dependencies: MagaluCustomerServiceDependencies = {}) {
    if (typeof userId !== "string" || !userId.trim()) {
      throw new AppError("Usuário autenticado necessário para consultar cliente Magalu", 401);
    }
    this.findAccount = dependencies.findAccount ?? (id => magaluTokenStorage.findAccount(id));
    this.deliveries = dependencies.deliveries ?? new MagaluDeliveryService(userId);
    this.invoices = dependencies.invoices ?? new MagaluInvoiceService(userId);
  }

  async getCustomer(input: GetMagaluCustomerInput): Promise<NormalizedCustomerData> {
    return (await this.getCustomerWithInvoices(input)).customer;
  }

  async getCustomerWithInvoices(input: GetMagaluCustomerInput): Promise<MagaluCustomerData> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Conta ou pedido Magalu inválido para extrair cliente", 400);
    const { marketplaceAccountId, order } = parsed.data;
    // A autorização é obrigatória mesmo quando não há necessidade de consultar NF-e.
    const account = await this.findAccount(marketplaceAccountId);
    if (!account || account.id !== marketplaceAccountId || account.userId !== this.userId ||
      account.platform !== "MAGALU" || !account.isActive) {
      throw new MagaluHttpError("Conta Magalu não encontrada para este usuário ou inativa.", 404, "invalid_account");
    }
    const primary = normalizeCustomerData({
      name: order.customer.name, phone: order.customer.phone,
      document: order.customer.document ?? null, documentType: order.customer.documentType ?? null,
    });
    const invoices: MagaluProcessedInvoice[] = [];
    if (complete(primary)) return { customer: primary, invoices };
    let customer = primary;
    let fallback: NormalizedCustomerData | null = null;
    let ambiguous = false;
    let incompleteCollection = false;
    const report = (error: unknown) => {
      const safeError = error instanceof MagaluHttpError ? error : new MagaluHttpError(
        "Não foi possível complementar o cliente pela NF-e Magalu.", 503, "unavailable",
      );
      // Um diagnóstico opcional não pode eliminar os dados válidos do pedido.
      try { input.onFallbackError?.(safeError); } catch { /* Preservar o resultado. */ }
    };

    try {
      for await (const batch of this.deliveries.getDeliveries({ marketplaceAccountId, externalOrderId: order.externalOrderId })) {
        for (const delivery of batch) {
          if (delivery.marketplaceAccountId !== marketplaceAccountId || delivery.externalOrderId !== order.externalOrderId ||
            delivery.platform !== "MAGALU") {
            throw new MagaluHttpError("A entrega Magalu não corresponde à conta e ao pedido consultados.", 502, "invalid_response");
          }
          try {
            const invoice = await this.invoices.getInvoice({ delivery, customer: primary, onInvoiceError: error => {
              incompleteCollection = true;
              report(error);
            } });
            if (!invoice) continue;
            const secondary = normalizeCustomerData({ name: invoice.customerName, phone: invoice.phone,
              document: invoice.document, documentType: invoice.documentType });
            if (primary.document !== null) {
              if (secondary.document !== null && secondary.document !== primary.document) {
                report(new MagaluHttpError("O destinatário da NF-e não corresponde ao documento do pedido Magalu.", 502, "invalid_response"));
                continue;
              }
              invoices.push(invoice);
              customer = mergeCustomerData(customer, secondary);
              if (complete(customer)) return { customer, invoices };
            } else {
              // Sem documento do comprador, conferir todos os pacotes antes de combinar.
              if (fallback && (secondary.document === null || fallback.document === null || secondary.document !== fallback.document)) {
                ambiguous = true;
              }
              invoices.push(invoice);
              fallback = fallback ? mergeCustomerData(fallback, secondary) : secondary;
            }
          } catch (error) {
            incompleteCollection = true;
            report(error);
          }
        }
      }
    } catch (error) {
      incompleteCollection = true;
      report(error);
    }
    if (primary.document !== null) return { customer, invoices };
    return fallback && !ambiguous && !incompleteCollection
      ? { customer: mergeCustomerData(primary, fallback), invoices }
      : { customer: primary, invoices: [] };
  }
}
