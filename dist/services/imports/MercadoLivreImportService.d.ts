import { MercadoLivreInvoiceService } from "../../integrations/mercadolivre/mercadoLivreInvoiceService";
import type { GetMercadoLivreOrdersInput } from "../../integrations/mercadolivre/mercadoLivreOrderService";
import { MercadoLivreRecipientService } from "../../integrations/mercadolivre/mercadoLivreRecipientService";
import type { MarketplaceOrder } from "../../integrations/types";
import { NFeParserService } from "../invoices/NFeParserService";
import { ImportedOrderPersistenceService } from "./ImportedOrderPersistenceService";
import type { ImportStorage, ImportSummary } from "./ImportRepository";
export interface MercadoLivreImportInput {
    marketplaceAccountId: string;
    userId: string;
    dateFrom: Date;
    dateTo: Date;
}
interface ImportDependencies {
    storage?: ImportStorage;
    orders?: {
        getOrders(input: GetMercadoLivreOrdersInput): AsyncIterable<MarketplaceOrder[]>;
    };
    recipients?: Pick<MercadoLivreRecipientService, "getRecipient">;
    invoices?: Pick<MercadoLivreInvoiceService, "getInvoiceXml">;
    parser?: Pick<NFeParserService, "parse">;
    persistence?: Pick<ImportedOrderPersistenceService, "execute">;
    concurrency?: number;
    batchSize?: number;
    nowFn?: () => Date;
}
export declare class MercadoLivreImportService {
    private readonly storage;
    private readonly orders;
    private readonly recipients;
    private readonly invoices;
    private readonly parser;
    private readonly persistence;
    private readonly concurrency;
    private readonly batchSize;
    private readonly nowFn;
    private readonly activeAccounts;
    constructor(dependencies?: ImportDependencies);
    execute(input: MercadoLivreImportInput): Promise<ImportSummary>;
    private run;
    private processBatch;
    private processOrder;
}
export {};
//# sourceMappingURL=MercadoLivreImportService.d.ts.map