import { Prisma } from "../../generated/prisma/client";
import type { MarketplaceOrder } from "../../integrations/types";
import type { ParsedNFeData } from "../invoices/NFeParserService";
export interface PersistImportedOrderInput {
    marketplaceAccountId: string;
    userId: string;
    order: MarketplaceOrder;
    invoice?: ParsedNFeData | null;
}
export interface PersistImportedOrderResult {
    orderId: string;
    customerId: string;
    invoiceId: string | null;
    created: boolean;
    itemsCount: number;
    customerHasPhone: boolean;
}
export type PersistenceTransactionRunner = <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
interface PersistenceDependencies {
    runTransaction?: PersistenceTransactionRunner;
    sleepFn?: (milliseconds: number) => Promise<void>;
}
/** Persiste um pedido normalizado inteiro; não consulta APIs nem processa XML. */
export declare class ImportedOrderPersistenceService {
    private readonly runTransaction;
    private readonly sleepFn;
    constructor(dependencies?: PersistenceDependencies);
    execute(input: PersistImportedOrderInput): Promise<PersistImportedOrderResult>;
    private persist;
    private resolveCustomer;
    private findCompatibleCustomer;
    private updateCustomer;
    private persistInvoice;
    private syncItems;
}
export {};
//# sourceMappingURL=ImportedOrderPersistenceService.d.ts.map