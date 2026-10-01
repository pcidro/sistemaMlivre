"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListMarketplaceAccountsService = void 0;
const prisma_1 = require("../../lib/prisma");
class ListMarketplaceAccountsService {
    async execute(userId) {
        return prisma_1.prisma.marketplaceAccount.findMany({
            where: {
                userId,
                isActive: true,
            },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                platform: true,
                name: true,
                cnpj: true,
                externalAccountId: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
}
exports.ListMarketplaceAccountsService = ListMarketplaceAccountsService;
//# sourceMappingURL=listMarketplaceAccountsService.js.map