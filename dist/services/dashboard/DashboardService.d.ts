import { Prisma } from "../../generated/prisma/client";
import type { Import } from "../../generated/prisma/client";
export interface DashboardSummary {
    totalCustomers: number;
    customersWithPhone: number;
    customersWithoutPhone: number;
    mercadoLivreCustomers: number;
    lastImport: Pick<Import, "startedAt" | "finishedAt" | "status" | "ordersProcessed"> | null;
}
export type DashboardReadTransaction = <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
export declare class DashboardService {
    private readonly readTransaction;
    constructor(readTransaction?: DashboardReadTransaction);
    execute(userId: string): Promise<DashboardSummary>;
}
//# sourceMappingURL=DashboardService.d.ts.map