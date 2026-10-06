import { MercadoLivreInvoiceService } from "../../integrations/mercadolivre/mercadoLivreInvoiceService";
import { MercadoLivreOrderService } from "../../integrations/mercadolivre/mercadoLivreOrderService";
import type { GetMercadoLivreOrdersInput } from "../../integrations/mercadolivre/mercadoLivreOrderService";
import { MercadoLivreRecipientService } from "../../integrations/mercadolivre/mercadoLivreRecipientService";
import { MercadoLivreRequestLimiter } from "../../integrations/mercadolivre/MercadoLivreRequestLimiter";
import { MercadoLivreTokenService } from "../../integrations/mercadolivre/mercadoLivreTokenService";
import type { MarketplaceOrder } from "../../integrations/types";
import { CustomerExtractionService } from "../customers/CustomerExtractionService";
import { NFeParserService } from "../invoices/NFeParserService";
import type { ParsedNFeData } from "../invoices/NFeParserService";
import { ImportedOrderPersistenceService } from "./ImportedOrderPersistenceService";
import { ImportRepository } from "./ImportRepository";
import type { ImportStorage, ImportSummary } from "./ImportRepository";
import { ImportRunner } from "./ImportRunner";
import type { MarketplaceImportInput } from "./ImportRunner";

export type MercadoLivreImportInput = MarketplaceImportInput;

interface ImportDependencies {
  storage?: ImportStorage;
  orders?: { getOrders(input: GetMercadoLivreOrdersInput): AsyncIterable<MarketplaceOrder[]> };
  recipients?: Pick<MercadoLivreRecipientService, "getRecipient">;
  invoices?: Pick<MercadoLivreInvoiceService, "getInvoiceXml">;
  parser?: Pick<NFeParserService, "parse">;
  persistence?: Pick<ImportedOrderPersistenceService, "execute">;
  concurrency?: number;
  batchSize?: number;
  nowFn?: () => Date;
}

export class MercadoLivreImportService {
  private readonly recipients: NonNullable<ImportDependencies["recipients"]>;
  private readonly invoices: NonNullable<ImportDependencies["invoices"]>;
  private readonly parser: NonNullable<ImportDependencies["parser"]>;
  private readonly persistence: NonNullable<ImportDependencies["persistence"]>;
  private readonly runner: ImportRunner;

  constructor(dependencies: ImportDependencies = {}) {
    const tokenService = new MercadoLivreTokenService();
    const fetchFn = new MercadoLivreRequestLimiter().fetch;
    const orders = dependencies.orders ?? new MercadoLivreOrderService({ tokenService, fetchFn });
    this.recipients = dependencies.recipients ?? new MercadoLivreRecipientService({ tokenService, fetchFn });
    this.invoices = dependencies.invoices ?? new MercadoLivreInvoiceService({ tokenService, fetchFn });
    this.parser = dependencies.parser ?? new NFeParserService();
    this.persistence = dependencies.persistence ?? new ImportedOrderPersistenceService();
    this.runner = new ImportRunner({
      platformName: "Mercado Livre", storage: dependencies.storage ?? new ImportRepository(),
      getOrders: (input, onOrderError) => orders.getOrders({ ...input, onOrderError }),
      processOrder: (order, input) => this.processOrder(order, input),
      ...(dependencies.concurrency === undefined ? {} : { concurrency: dependencies.concurrency }),
      ...(dependencies.batchSize === undefined ? {} : { batchSize: dependencies.batchSize }),
      ...(dependencies.nowFn === undefined ? {} : { nowFn: dependencies.nowFn }),
    });
  }

  async execute(input: MercadoLivreImportInput, registered?: ImportSummary): Promise<ImportSummary> {
    return this.runner.execute(input, registered);
  }

  private async processOrder(order: MarketplaceOrder, input: MercadoLivreImportInput): Promise<{ customerHasPhone: boolean; hasErrors: boolean }> {
    let invoice: ParsedNFeData | null = null;
    let hasErrors = false;
    // Captura somente o resultado do parser, sem guardar o XML nem processá-lo duas vezes.
    const extraction = new CustomerExtractionService({
      parse: (xml) => { invoice = this.parser.parse(xml); return invoice; },
    });
    const customer = await extraction.extract({
      onInvoiceError: () => { hasErrors = true; },
      getRecipient: () => this.recipients.getRecipient(input.marketplaceAccountId, order),
      getInvoiceXml: () => this.invoices.getInvoiceXml({
        marketplaceAccountId: input.marketplaceAccountId,
        userId: input.userId, externalOrderId: order.externalOrderId,
      }),
    });
    const result = await this.persistence.execute({
      marketplaceAccountId: input.marketplaceAccountId, userId: input.userId,
      order: { ...order, customer }, invoice,
    });
    return { customerHasPhone: result.customerHasPhone, hasErrors };
  }
}
