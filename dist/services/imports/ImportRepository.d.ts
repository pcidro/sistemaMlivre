import type { Import } from "../../generated/prisma/client";
export type ImportSummary = Pick<Import, "id" | "marketplaceAccountId" | "status" | "startedAt" | "finishedAt" | "ordersFound" | "ordersProcessed" | "customersWithPhone" | "customersWithoutPhone" | "errorsCount">;
export type ImportCounters = Pick<ImportSummary, "ordersFound" | "ordersProcessed" | "customersWithPhone" | "customersWithoutPhone" | "errorsCount">;
export interface ImportStorage {
    ownsActiveAccount(accountId: string, userId: string): Promise<boolean>;
    create(accountId: string): Promise<ImportSummary>;
    update(id: string, data: ImportCounters & {
        status?: ImportSummary["status"];
        finishedAt?: Date;
    }): Promise<ImportSummary>;
}
export declare class ImportRepository implements ImportStorage {
    ownsActiveAccount(accountId: string, userId: string): Promise<boolean>;
    create(accountId: string): Promise<ImportSummary>;
    update(id: string, data: Parameters<ImportStorage["update"]>[1]): Promise<ImportSummary>;
}
//# sourceMappingURL=ImportRepository.d.ts.map