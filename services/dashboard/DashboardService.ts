import { z } from "zod";

import { AppError } from "../../errors/AppError";
import { Prisma } from "../../generated/prisma/client";
import type { Import } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";

export interface DashboardSummary {
  totalCustomers: number;
  customersWithPhone: number;
  customersWithoutPhone: number;
  mercadoLivreCustomers: number;
  lastImport: Pick<Import, "startedAt" | "finishedAt" | "status" | "ordersProcessed"> | null;
}

export type DashboardReadTransaction = <T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) => Promise<T>;

const countsSchema = z.object({
  totalCustomers: z.number().int().nonnegative(),
  customersWithPhone: z.number().int().nonnegative(),
  mercadoLivreCustomers: z.number().int().nonnegative(),
}).refine((row) => row.customersWithPhone <= row.totalCustomers &&
  row.mercadoLivreCustomers <= row.totalCustomers);

export class DashboardService {
  constructor(private readonly readTransaction: DashboardReadTransaction = (work) =>
    prisma.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 5_000, timeout: 10_000,
    }),
  ) {}

  async execute(userId: string): Promise<DashboardSummary> {
    userId = z.string().trim().min(1).parse(userId);
    try {
      return await this.readTransaction(async (tx) => {
        // Agrupa primeiro por cliente para não contar cada pedido/conta como uma pessoa.
        const rows = await tx.$queryRaw<unknown[]>(Prisma.sql`
          WITH customer_origins AS (
            SELECT o.customer_id,
              BOOL_OR(o.platform = 'MERCADO_LIVRE') AS has_mercado_livre
            FROM orders o
            JOIN marketplace_accounts a ON a.id = o.marketplace_account_id
            WHERE a.user_id = ${userId}
            GROUP BY o.customer_id
          )
          SELECT
            COUNT(*)::integer AS "totalCustomers",
            (COUNT(*) FILTER (
              WHERE c.normalized_phone IS NOT NULL AND c.normalized_phone <> ''
            ))::integer AS "customersWithPhone",
            (COUNT(*) FILTER (
              WHERE origins.has_mercado_livre
            ))::integer AS "mercadoLivreCustomers"
          FROM customer_origins origins
          JOIN customers c ON c.id = origins.customer_id
        `);
        const counts = z.array(countsSchema).length(1).parse(rows)[0]!;
        const lastImport = await tx.import.findFirst({
          where: { marketplaceAccount: { userId } },
          orderBy: [{ startedAt: "desc" }, { id: "desc" }],
          select: { startedAt: true, finishedAt: true, status: true, ordersProcessed: true },
        });
        return {
          totalCustomers: counts.totalCustomers,
          customersWithPhone: counts.customersWithPhone,
          customersWithoutPhone: counts.totalCustomers - counts.customersWithPhone,
          mercadoLivreCustomers: counts.mercadoLivreCustomers,
          lastImport: lastImport ? {
            startedAt: lastImport.startedAt, finishedAt: lastImport.finishedAt,
            status: lastImport.status, ordersProcessed: lastImport.ordersProcessed,
          } : null,
        };
      });
    } catch {
      throw new AppError("Não foi possível consultar os dados do dashboard", 503);
    }
  }
}
