import type { Import } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";

export type ImportSummary = Pick<Import,
  "id" | "marketplaceAccountId" | "status" | "startedAt" | "finishedAt" |
  "ordersFound" | "ordersProcessed" | "customersWithPhone" |
  "customersWithoutPhone" | "errorsCount"
>;

export type ImportCounters = Pick<ImportSummary,
  "ordersFound" | "ordersProcessed" | "customersWithPhone" |
  "customersWithoutPhone" | "errorsCount"
>;

export interface ImportStorage {
  ownsActiveAccount(accountId: string, userId: string): Promise<boolean>;
  create(accountId: string): Promise<ImportSummary>;
  update(id: string, data: ImportCounters & {
    status?: ImportSummary["status"];
    finishedAt?: Date;
  }): Promise<ImportSummary>;
}

const summarySelect = {
  id: true, marketplaceAccountId: true, status: true,
  startedAt: true, finishedAt: true, ordersFound: true, ordersProcessed: true,
  customersWithPhone: true, customersWithoutPhone: true, errorsCount: true,
} as const;

export class ImportRepository implements ImportStorage {
  async ownsActiveAccount(accountId: string, userId: string): Promise<boolean> {
    return await prisma.marketplaceAccount.findFirst({
      where: { id: accountId, userId, platform: "MERCADO_LIVRE", isActive: true },
      select: { id: true },
    }) !== null;
  }

  create(accountId: string): Promise<ImportSummary> {
    return prisma.import.create({
      data: { marketplaceAccountId: accountId, platform: "MERCADO_LIVRE", status: "PROCESSING" },
      select: summarySelect,
    });
  }

  update(id: string, data: Parameters<ImportStorage["update"]>[1]): Promise<ImportSummary> {
    return prisma.import.update({ where: { id }, data, select: summarySelect });
  }
}
