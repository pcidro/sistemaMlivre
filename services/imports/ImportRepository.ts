import type { Import } from "../../generated/prisma/client";
import type { MarketplacePlatform } from "../../integrations/types";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

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
  touch?(id: string): Promise<void>;
  ownsActiveAccount(accountId: string, userId: string): Promise<boolean>;
  create(accountId: string): Promise<ImportSummary>;
  update(id: string, data: ImportCounters & {
    status?: ImportSummary["status"];
    finishedAt?: Date;
  }): Promise<ImportSummary>;
}

export const summarySelect = {
  id: true, marketplaceAccountId: true, status: true,
  startedAt: true, finishedAt: true, ordersFound: true, ordersProcessed: true,
  customersWithPhone: true, customersWithoutPhone: true, errorsCount: true,
} as const;

export class ImportRepository implements ImportStorage {
  constructor(
    private readonly platform: MarketplacePlatform = "MERCADO_LIVRE",
    private readonly database: Pick<typeof prisma, "marketplaceAccount" | "import"> = prisma,
  ) {}

  async ownsActiveAccount(accountId: string, userId: string): Promise<boolean> {
    return await this.database.marketplaceAccount.findFirst({
      where: { id: accountId, userId, platform: this.platform, isActive: true },
      select: { id: true },
    }) !== null;
  }

  async create(accountId: string): Promise<ImportSummary> {
    try { return await this.database.import.create({
      data: { marketplaceAccountId: accountId, platform: this.platform, status: "PROCESSING" },
      select: summarySelect,
    }); } catch (error) {
      if (this.platform === "MERCADO_LIVRE" && typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new AppError("Já existe uma importação em andamento para esta conta", 409);
      }
      throw error;
    }
  }

  update(id: string, data: Parameters<ImportStorage["update"]>[1]): Promise<ImportSummary> {
    return this.database.import.update({ where: { id, ...(this.platform === "MERCADO_LIVRE" ? { status: "PROCESSING" as const } : {}) }, data, select: summarySelect });
  }

  async touch(id: string): Promise<void> {
    if (this.platform !== "MERCADO_LIVRE") return;
    const result = await this.database.import.updateMany({ where: { id, status: "PROCESSING" }, data: { updatedAt: new Date() } });
    if (!result.count) throw new AppError("A importação foi interrompida. Inicie uma nova sincronização", 409);
  }
}
