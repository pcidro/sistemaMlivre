import { AppError } from "../../errors/AppError";
import { MagaluCustomerService } from "../../integrations/magalu/MagaluCustomerService";
import type { GetMagaluCustomerInput } from "../../integrations/magalu/MagaluCustomerService";
import type { MarketplaceOrder } from "../../integrations/types";
import type { ParsedNFeData } from "../invoices/NFeParserService";
import { ImportedOrderPersistenceService } from "./ImportedOrderPersistenceService";
import type { PersistImportedOrderResult } from "./ImportedOrderPersistenceService";

export interface ImportMagaluOrderInput {
  marketplaceAccountId: string;
  /** Pedido normalizado por MagaluOrderMapper/MagaluOrderService; code é a identidade externa. */
  order: MarketplaceOrder;
  onFallbackError?: GetMagaluCustomerInput["onFallbackError"];
}

interface MagaluOrderImportDependencies {
  customers?: Pick<MagaluCustomerService, "getCustomerWithInvoices">;
  persistence?: Pick<ImportedOrderPersistenceService, "execute">;
}

/** Coordena um pedido; toda a escrita e deduplicação ficam no serviço compartilhado. */
export class MagaluOrderImportService {
  private readonly customers: Pick<MagaluCustomerService, "getCustomerWithInvoices">;
  private readonly persistence: Pick<ImportedOrderPersistenceService, "execute">;

  constructor(private readonly userId: string, dependencies: MagaluOrderImportDependencies = {}) {
    if (typeof userId !== "string" || !userId.trim()) {
      throw new AppError("Usuário autenticado necessário para importar pedido Magalu", 401);
    }
    this.customers = dependencies.customers ?? new MagaluCustomerService(userId);
    this.persistence = dependencies.persistence ?? new ImportedOrderPersistenceService();
  }

  async execute(input: ImportMagaluOrderInput): Promise<PersistImportedOrderResult> {
    if (!input || input.order?.platform !== "MAGALU") {
      throw new AppError("A importação exige um pedido Magalu normalizado", 422);
    }
    const extracted = await this.customers.getCustomerWithInvoices({
      marketplaceAccountId: input.marketplaceAccountId, order: input.order,
      ...(input.onFallbackError === undefined ? {} : { onFallbackError: input.onFallbackError }),
    });
    // Projeção explícita: issuedAt/status da API e XML não entram na persistência.
    const invoices: ParsedNFeData[] = extracted.invoices.map(invoice => ({
      invoiceKey: invoice.invoiceKey, invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName, phone: invoice.phone,
      document: invoice.document, documentType: invoice.documentType,
    }));
    return this.persistence.execute({
      userId: this.userId, marketplaceAccountId: input.marketplaceAccountId,
      order: { ...input.order, customer: extracted.customer }, invoices,
    });
  }
}
