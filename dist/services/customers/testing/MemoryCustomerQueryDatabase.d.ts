import type { Prisma } from "../../../generated/prisma/client";
import type { CustomerReadTransaction } from "../CustomerQueryService";
export declare const fixtureId: (value: number) => string;
interface CustomerFixture {
    id: string;
    name: string | null;
    phone: string | null;
    normalizedPhone: string | null;
    document?: string | null;
    documentType?: "CPF" | "CNPJ" | null;
}
interface AccountFixture {
    id: string;
    userId: string | null;
    name: string;
    cnpj: string | null;
    isActive: boolean;
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string;
}
interface OrderFixture {
    id: string;
    customerId: string;
    marketplaceAccountId: string;
    platform: "MERCADO_LIVRE" | "MAGALU";
    externalOrderId: string;
    orderDate: Date | null;
    createdAt: Date;
}
/** Avalia apenas os filtros usados nestas consultas; não substitui PostgreSQL. */
export declare class MemoryCustomerQueryDatabase {
    calls: {
        count: number;
        findMany: number;
        findFirst: number;
        transactions: number;
    };
    lastFindMany: Prisma.CustomerFindManyArgs | undefined;
    lastCount: Prisma.CustomerCountArgs | undefined;
    lastFindFirst: Prisma.CustomerFindFirstArgs | undefined;
    fail: boolean;
    customers: CustomerFixture[];
    accounts: AccountFixture[];
    orders: OrderFixture[];
    private order;
    private matchesOrder;
    private matchesCustomer;
    private project;
    readonly readTransaction: CustomerReadTransaction;
}
export {};
//# sourceMappingURL=MemoryCustomerQueryDatabase.d.ts.map