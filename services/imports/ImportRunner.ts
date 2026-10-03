import { z } from "zod";

import { AppError } from "../../errors/AppError";
import type { MarketplaceOrder } from "../../integrations/types";
import type { ImportCounters, ImportStorage, ImportSummary } from "./ImportRepository";

export interface MarketplaceImportInput {
  marketplaceAccountId: string;
  userId: string;
  dateFrom: Date;
  dateTo: Date;
}

interface ImportRunnerOptions {
  platformName: string;
  storage: ImportStorage;
  getOrders(input: MarketplaceImportInput, onOrderError: () => void): AsyncIterable<MarketplaceOrder[]>;
  processOrder(order: MarketplaceOrder, input: MarketplaceImportInput): Promise<{
    customerHasPhone: boolean;
    hasErrors?: boolean;
  }>;
  concurrency?: number;
  batchSize?: number;
  nowFn?: () => Date;
}

const inputSchema = z.object({
  marketplaceAccountId: z.string().trim().min(1), userId: z.string().trim().min(1),
  dateFrom: z.date(), dateTo: z.date(),
}).strict().refine(input => input.dateFrom <= input.dateTo);

/** Coordenação compartilhada; formatos e regras dos marketplaces ficam nos adapters. */
export class ImportRunner {
  private readonly concurrency: number;
  private readonly batchSize: number;
  private readonly nowFn: () => Date;
  private readonly activeAccounts = new Set<string>();

  constructor(private readonly options: ImportRunnerOptions) {
    this.concurrency = options.concurrency ?? 3;
    this.batchSize = options.batchSize ?? 20;
    this.nowFn = options.nowFn ?? (() => new Date());
    if (!Number.isInteger(this.concurrency) || this.concurrency < 1 || this.concurrency > 10 ||
      !Number.isInteger(this.batchSize) || this.batchSize < 1 || this.batchSize > 50) {
      throw new Error("Configuração de lotes da importação inválida");
    }
  }

  async execute(input: MarketplaceImportInput): Promise<ImportSummary> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Dados da importação inválidos", 400);
    input = parsed.data;
    let ownsAccount: boolean;
    try {
      ownsAccount = await this.options.storage.ownsActiveAccount(input.marketplaceAccountId, input.userId);
    } catch {
      throw new AppError(`Não foi possível validar a conta do ${this.options.platformName}`, 503);
    }
    if (!ownsAccount) throw new AppError(`Conta do ${this.options.platformName} não encontrada para este usuário ou inativa`, 404);
    if (this.activeAccounts.has(input.marketplaceAccountId)) {
      throw new AppError("Já existe uma importação em andamento para esta conta", 409);
    }
    this.activeAccounts.add(input.marketplaceAccountId);
    try {
      return await this.run(input);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Não foi possível registrar o resultado da importação", 503);
    } finally {
      this.activeAccounts.delete(input.marketplaceAccountId);
    }
  }

  private async run(input: MarketplaceImportInput): Promise<ImportSummary> {
    const { storage } = this.options;
    const record = await storage.create(input.marketplaceAccountId);
    const counters: ImportCounters = {
      ordersFound: 0, ordersProcessed: 0, customersWithPhone: 0, customersWithoutPhone: 0, errorsCount: 0,
    };
    // Guarda somente identidades; nunca acumula os pedidos ou XMLs do período.
    const seen = new Set<string>();
    try {
      for await (const page of this.options.getOrders(input, () => { counters.ordersFound++; counters.errorsCount++; })) {
        const unique = page.filter(order => {
          if (seen.has(order.externalOrderId)) return false;
          seen.add(order.externalOrderId);
          return true;
        });
        counters.ordersFound += unique.length;
        await storage.update(record.id, { ...counters });
        for (let start = 0; start < unique.length; start += this.batchSize) {
          await this.processBatch(unique.slice(start, start + this.batchSize), input, counters);
          await storage.update(record.id, { ...counters });
        }
      }
    } catch {
      // Paginação/progresso indisponíveis: dados já salvos permanecem válidos.
      counters.errorsCount++;
    }
    const status = counters.errorsCount === 0 ? "SUCCESS" : counters.ordersProcessed > 0 ? "PARTIAL_SUCCESS" : "ERROR";
    return storage.update(record.id, { ...counters, status, finishedAt: this.nowFn() });
  }

  private async processBatch(batch: MarketplaceOrder[], input: MarketplaceImportInput, counters: ImportCounters): Promise<void> {
    let index = 0;
    const worker = async () => {
      while (index < batch.length) {
        const order = batch[index++];
        if (!order) continue;
        try {
          const outcome = await this.options.processOrder(order, input);
          counters.ordersProcessed++;
          if (outcome.customerHasPhone) counters.customersWithPhone++;
          else counters.customersWithoutPhone++;
          if (outcome.hasErrors) counters.errorsCount++;
        } catch {
          counters.errorsCount++;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, batch.length) }, worker));
  }
}
