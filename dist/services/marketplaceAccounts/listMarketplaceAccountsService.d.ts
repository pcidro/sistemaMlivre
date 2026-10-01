export declare class ListMarketplaceAccountsService {
    execute(userId: string): Promise<{
        cnpj: string | null;
        createdAt: Date;
        externalAccountId: string;
        id: string;
        isActive: boolean;
        name: string;
        platform: import("../../generated/prisma/enums").MarketplacePlatform;
        updatedAt: Date;
    }[]>;
}
//# sourceMappingURL=listMarketplaceAccountsService.d.ts.map