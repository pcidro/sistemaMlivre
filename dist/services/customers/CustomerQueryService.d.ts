import { Prisma } from "../../generated/prisma/client";
export type CustomerReadTransaction = <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
export declare class CustomerQueryService {
    private readonly readTransaction;
    constructor(readTransaction?: CustomerReadTransaction);
    list(userId: string, query: unknown): Promise<{
        data: {
            customerId: string;
            name: string | null;
            phone: string | null;
            normalizedPhone: string | null;
            document: string | null;
            documentType: import("../../generated/prisma/enums").DocumentType | null;
            platform: import("../../generated/prisma/enums").MarketplacePlatform;
            marketplaceAccount: {
                id: string;
                name: string;
                cnpj: string | null;
            };
            externalOrderId: string;
            orderDate: Date | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    get(userId: string, customerId: string): Promise<{
        customerId: string;
        name: string | null;
        phone: string | null;
        normalizedPhone: string | null;
        document: string | null;
        documentType: import("../../generated/prisma/enums").DocumentType | null;
        platform: import("../../generated/prisma/enums").MarketplacePlatform;
        marketplaceAccount: {
            id: string;
            name: string;
            cnpj: string | null;
        };
        externalOrderId: string;
        orderDate: Date | null;
    }>;
}
//# sourceMappingURL=CustomerQueryService.d.ts.map