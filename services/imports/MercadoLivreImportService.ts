import { z } from "zod";

import { AppError } from "../../errors/AppError";
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
import type { ImportCounters, ImportStorage, ImportSummary } from "./ImportRepository";

export interface MercadoLivreImportInput {
  marketplaceAccountId: string;
  userId: string;
  dateFrom: Date;
  dateTo: Date;
}

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

const inputSchema = z.object({
  marketplaceAccountId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  dateFrom: z.date(), dateTo: z.date(),
}).strict().refine((input) => input.dateFrom <= input.dateTo);

export class MercadoLivreImportService {
  private readonly storage: ImportStorage;
  private readonly orders: NonNullable<ImportDependencies["orders"]>;
  private readonly recipients: NonNullable<ImportDependencies["recipients"]>;
  private readonly invoices: NonNullable<ImportDependencies["invoices"]>;
  private readonly parser: NonNullable<ImportDependencies["parser"]>;
  private readonly persistence: NonNullable<ImportDependencies["persistence"]>;
  private readonly concurrency: number;
  private readonly batchSize: number;
  private readonly nowFn: () => Date;
  private readonly activeAccounts = new Set<string>();

  constructor(dependencies: ImportDependencies = {}) {
    const tokenService = new MercadoLivreTokenService();
    const fetchFn = new MercadoLivreRequestLimiter().fetch;
    this.storage = dependencies.storage ?? new ImportRepository();
    this.orders = dependencies.orders ?? new MercadoLivreOrderService({ tokenService, fetchFn });
    this.recipients = dependencies.recipients ?? new MercadoLivreRecipientService({ tokenService, fetchFn });
    this.invoices = dependencies.invoices ?? new MercadoLivreInvoiceService({ tokenService, fetchFn });
    this.parser = dependencies.parser ?? new NFeParserService();
    this.persistence = dependencies.persistence ?? new ImportedOrderPersistenceService();
    this.concurrency = dependencies.concurrency ?? 3;
    this.batchSize = dependencies.batchSize ?? 20;
    this.nowFn = dependencies.nowFn ?? (() => new Date());
    if (!Number.isInteger(this.concurrency) || this.concurrency < 1 || this.concurrency > 10 ||
        !Number.isInteger(this.batchSize) || this.batchSize < 1 || this.batchSize > 50) {
      throw new Error("Configuração de lotes da importação inválida");
    }
  }

  async execute(input: MercadoLivreImportInput): Promise<ImportSummary> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Dados da importação inválidos", 400);
    input = parsed.data;
    let ownsAccount: boolean;
    try {
      ownsAccount = await this.storage.ownsActiveAccount(input.marketplaceAccountId, input.userId);
    } catch {
      throw new AppError("Não foi possível validar a conta do Mercado Livre", 503);
    }
    if (!ownsAccount) {
      throw new AppError("Conta do Mercado Livre não encontrada para este usuário ou inativa", 404);
    }
    if (this.activeAccounts.has(input.marketplaceAccountId)) {
      throw new AppError("Já existe uma importação em andamento para esta conta", 409);
    }
    this.activeAccounts.add(input.marketplaceAccountId);
    try {
      return await this.run(input);
    } catch (error) {
      if (error instanceof AppError) throw error;
      // Nunca repassar mensagens do banco ou payloads externos ao tratamento HTTP.
      throw new AppError("Não foi possível registrar o resultado da importação", 503);
    } finally {
      this.activeAccounts.delete(input.marketplaceAccountId);
    }
  }

  private async run(input: MercadoLivreImportInput): Promise<ImportSummary> {
    const record = await this.storage.create(input.marketplaceAccountId);
    const counters: ImportCounters = {
      ordersFound: 0, ordersProcessed: 0, customersWithPhone: 0,
      customersWithoutPhone: 0, errorsCount: 0,
    };
    const seen = new Set<string>();
    try {
      for await (const page of this.orders.getOrders({
        ...input,
        onOrderError: () => { counters.ordersFound++; counters.errorsCount++; },
      })) {
        const unique = page.filter((order) => {
          if (seen.has(order.externalOrderId)) return false;
          seen.add(order.externalOrderId);
          return true;
        });
        counters.ordersFound += unique.length;
        await this.storage.update(record.id, { ...counters });
        for (let start = 0; start < unique.length; start += this.batchSize) {
          await this.processBatch(unique.slice(start, start + this.batchSize), input, counters);
          await this.storage.update(record.id, { ...counters });
        }
      }
    } catch {
      // Falha de paginação ou de registro do progresso; os pedidos já salvos permanecem válidos.
      counters.errorsCount++;
    }
    const status = counters.errorsCount === 0 ? "SUCCESS"
      : counters.ordersProcessed > 0 ? "PARTIAL_SUCCESS" : "ERROR";
    return this.storage.update(record.id, { ...counters, status, finishedAt: this.nowFn() });
  }

  private async processBatch(
    batch: MarketplaceOrder[], input: MercadoLivreImportInput, counters: ImportCounters,
  ): Promise<void> {
    let index = 0;
    const worker = async () => {
      while (index < batch.length) {
        const order = batch[index++];
        if (!order) continue;
        try {
          const hasPhone = await this.processOrder(order, input);
          counters.ordersProcessed++;
          if (hasPhone) counters.customersWithPhone++;
          else counters.customersWithoutPhone++;
        } catch {
          counters.errorsCount++;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, batch.length) }, worker));
  }

  private async processOrder(order: MarketplaceOrder, input: MercadoLivreImportInput): Promise<boolean> {
    let invoice: ParsedNFeData | null = null;
    // Captura somente o resultado do parser, sem guardar o XML nem processá-lo duas vezes.
    const extraction = new CustomerExtractionService({
      parse: (xml) => { invoice = this.parser.parse(xml); return invoice; },
    });
    const customer = await extraction.extract({
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
    return result.customerHasPhone;
  }
}
