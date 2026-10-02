"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const client_1 = require("../../generated/prisma/client");
const prisma_1 = require("../../lib/prisma");
const countsSchema = zod_1.z.object({
    totalCustomers: zod_1.z.number().int().nonnegative(),
    customersWithPhone: zod_1.z.number().int().nonnegative(),
    mercadoLivreCustomers: zod_1.z.number().int().nonnegative(),
}).refine((row) => row.customersWithPhone <= row.totalCustomers &&
    row.mercadoLivreCustomers <= row.totalCustomers);
class DashboardService {
    readTransaction;
    constructor(readTransaction = (work) => prisma_1.prisma.$transaction(work, {
        isolationLevel: client_1.Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 5_000, timeout: 10_000,
    })) {
        this.readTransaction = readTransaction;
    }
    async execute(userId) {
        userId = zod_1.z.string().trim().min(1).parse(userId);
        try {
            return await this.readTransaction(async (tx) => {
                // Agrupa primeiro por cliente para não contar cada pedido/conta como uma pessoa.
                const rows = await tx.$queryRaw(client_1.Prisma.sql `
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
                const counts = zod_1.z.array(countsSchema).length(1).parse(rows)[0];
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
        }
        catch {
            throw new AppError_1.AppError("Não foi possível consultar os dados do dashboard", 503);
        }
    }
}
exports.DashboardService = DashboardService;
//# sourceMappingURL=DashboardService.js.map