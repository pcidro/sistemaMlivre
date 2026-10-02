"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportRepository = void 0;
const prisma_1 = require("../../lib/prisma");
const summarySelect = {
    id: true, marketplaceAccountId: true, status: true,
    startedAt: true, finishedAt: true, ordersFound: true, ordersProcessed: true,
    customersWithPhone: true, customersWithoutPhone: true, errorsCount: true,
};
class ImportRepository {
    async ownsActiveAccount(accountId, userId) {
        return await prisma_1.prisma.marketplaceAccount.findFirst({
            where: { id: accountId, userId, platform: "MERCADO_LIVRE", isActive: true },
            select: { id: true },
        }) !== null;
    }
    create(accountId) {
        return prisma_1.prisma.import.create({
            data: { marketplaceAccountId: accountId, platform: "MERCADO_LIVRE", status: "PROCESSING" },
            select: summarySelect,
        });
    }
    update(id, data) {
        return prisma_1.prisma.import.update({ where: { id }, data, select: summarySelect });
    }
}
exports.ImportRepository = ImportRepository;
//# sourceMappingURL=ImportRepository.js.map