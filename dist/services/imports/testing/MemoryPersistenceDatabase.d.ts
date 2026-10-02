import type { Customer, Invoice, Order, OrderItem } from "../../../generated/prisma/client";
import type { PersistenceTransactionRunner } from "../ImportedOrderPersistenceService";
interface Account {
    id: string;
    userId: string;
    platform: "MERCADO_LIVRE" | "MAGALU";
    isActive: boolean;
}
export interface MemoryState {
    accounts: Account[];
    customers: Customer[];
    orders: Order[];
    invoices: Invoice[];
    items: OrderItem[];
}
/** Double de testes: verifica o estado e rollback; não simula locks do PostgreSQL. */
export declare class MemoryPersistenceDatabase {
    state: MemoryState;
    transactionAttempts: number;
    failuresBeforeCommit: string[];
    failItemWrite: boolean;
    private sequence;
    readonly runTransaction: PersistenceTransactionRunner;
    private id;
    private transaction;
}
export {};
//# sourceMappingURL=MemoryPersistenceDatabase.d.ts.map