import { MagaluOrderService } from "../../integrations/magalu/MagaluOrderService";
import type { GetMagaluOrdersInput } from "../../integrations/magalu/MagaluOrderService";
import type { MarketplaceOrder } from "../../integrations/types";
import { ImportRepository } from "./ImportRepository";
import type { ImportStorage, ImportSummary } from "./ImportRepository";
import { ImportRunner } from "./ImportRunner";
import type { MarketplaceImportInput } from "./ImportRunner";
import { MagaluOrderImportService } from "./MagaluOrderImportService";

export type MagaluImportInput = MarketplaceImportInput;

interface MagaluImportDependencies {
  storage?: ImportStorage;
  orders?: { getOrders(input: GetMagaluOrdersInput): AsyncIterable<MarketplaceOrder[]> };
  createOrderImporter?: (userId: string) => Pick<MagaluOrderImportService, "execute">;
  concurrency?: number;
  batchSize?: number;
  nowFn?: () => Date;
}

export class MagaluImportService {
  private readonly runner: ImportRunner;

  constructor(dependencies: MagaluImportDependencies = {}) {
    const createOrderImporter = dependencies.createOrderImporter ?? (userId => new MagaluOrderImportService(userId));
    this.runner = new ImportRunner({
      platformName: "Magalu", storage: dependencies.storage ?? new ImportRepository("MAGALU"),
      getOrders: (input, onOrderError) => (dependencies.orders ?? new MagaluOrderService(input.userId)).getOrders({
        marketplaceAccountId: input.marketplaceAccountId, dateFrom: input.dateFrom, dateTo: input.dateTo, onOrderError,
      }),
      processOrder: async (order, input) => {
        let hasErrors = false;
        const result = await createOrderImporter(input.userId).execute({
          marketplaceAccountId: input.marketplaceAccountId, order, onFallbackError: () => { hasErrors = true; },
        });
        return { customerHasPhone: result.customerHasPhone, hasErrors };
      },
      ...(dependencies.concurrency === undefined ? {} : { concurrency: dependencies.concurrency }),
      ...(dependencies.batchSize === undefined ? {} : { batchSize: dependencies.batchSize }),
      ...(dependencies.nowFn === undefined ? {} : { nowFn: dependencies.nowFn }),
    });
  }

  execute(input: MagaluImportInput): Promise<ImportSummary> {
    return this.runner.execute(input);
  }
}
