import { prisma } from "../../lib/prisma";

export class ListMarketplaceAccountsService {
  async execute(userId: string) {
    return prisma.marketplaceAccount.findMany({
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
