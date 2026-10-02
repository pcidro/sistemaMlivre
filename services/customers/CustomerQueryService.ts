import { z } from "zod";

import { AppError } from "../../errors/AppError";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { customerIdSchema, customerListQuerySchema } from "../../schemas/customerSchemas";
import type { CustomerListFilters } from "../../schemas/customerSchemas";
import { normalizeDocument } from "../../utils/normalizeDocument";

export type CustomerReadTransaction = <T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) => Promise<T>;

function literalSearch(value: string): string {
  // contains usa LIKE/ILIKE no PostgreSQL: tratar curingas como texto da busca.
  return value.replace(/[\\%_]/g, "\\$&");
}

function orderFilter(userId: string, filters?: CustomerListFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { marketplaceAccount: { userId } };
  if (!filters) return where;
  if (filters.platform) where.platform = filters.platform;
  if (filters.marketplaceAccountId) where.marketplaceAccountId = filters.marketplaceAccountId;
  if (filters.dateFrom || filters.dateTo) {
    where.orderDate = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }
  if (filters.search) {
    const text = literalSearch(filters.search);
    const document = normalizeDocument(filters.search);
    const customerSearch: Prisma.CustomerWhereInput[] = [
      { name: { contains: text, mode: "insensitive" } },
      { phone: { contains: text, mode: "insensitive" } },
      { normalizedPhone: { contains: text } },
      { document: document ?? { contains: text } },
    ];
    if (/^[+\d\s()./-]+$/.test(filters.search)) {
      const digits = filters.search.replace(/\D/g, "");
      if (digits) {
        customerSearch.push({ normalizedPhone: { contains: digits } }, { phone: { contains: digits } });
        if (!document) customerSearch.push({ document: { contains: digits } });
      }
    }
    where.OR = [
      { externalOrderId: { contains: text, mode: "insensitive" } },
      { customer: { OR: customerSearch } },
    ];
  }
  return where;
}

function customerSelect(ordersWhere: Prisma.OrderWhereInput) {
  return {
    id: true, name: true, phone: true, normalizedPhone: true,
    document: true, documentType: true,
    orders: {
      where: ordersWhere,
      take: 1,
      orderBy: [
        { orderDate: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" }, { id: "desc" },
      ],
      select: {
        externalOrderId: true, orderDate: true, platform: true,
        marketplaceAccount: { select: { id: true, name: true, cnpj: true } },
      },
    },
  } satisfies Prisma.CustomerSelect;
}

type CustomerRow = Prisma.CustomerGetPayload<{ select: ReturnType<typeof customerSelect> }>;

function toCustomerResult(row: CustomerRow) {
  const order = row.orders[0];
  if (!order) throw new AppError("Não foi possível consultar os dados do cliente", 503);
  return {
    customerId: row.id, name: row.name, phone: row.phone, normalizedPhone: row.normalizedPhone,
    document: row.document, documentType: row.documentType,
    platform: order.platform,
    marketplaceAccount: {
      id: order.marketplaceAccount.id,
      name: order.marketplaceAccount.name,
      cnpj: order.marketplaceAccount.cnpj,
    },
    externalOrderId: order.externalOrderId, orderDate: order.orderDate,
  };
}

export class CustomerQueryService {
  constructor(private readonly readTransaction: CustomerReadTransaction = (work) =>
    prisma.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 5_000, timeout: 10_000,
    }),
  ) {}

  async list(userId: string, query: unknown) {
    userId = z.string().trim().min(1).parse(userId);
    const filters = customerListQuerySchema.parse(query);
    const ordersWhere = orderFilter(userId, filters);
    const where: Prisma.CustomerWhereInput = { orders: { some: ordersWhere } };
    if (filters.hasPhone === true) {
      where.AND = [{ normalizedPhone: { not: null } }, { normalizedPhone: { not: "" } }];
    } else if (filters.hasPhone === false) {
      where.OR = [{ normalizedPhone: null }, { normalizedPhone: "" }];
    }
    try {
      return await this.readTransaction(async (tx) => {
        const total = await tx.customer.count({ where });
        const customers = await tx.customer.findMany({
          where, select: customerSelect(ordersWhere),
          orderBy: [{ name: { sort: "asc", nulls: "last" } }, { id: "asc" }],
          skip: (filters.page - 1) * filters.limit, take: filters.limit,
        });
        return {
          data: customers.map(toCustomerResult),
          pagination: {
            page: filters.page, limit: filters.limit,
            total, totalPages: Math.ceil(total / filters.limit),
          },
        };
      });
    } catch {
      throw new AppError("Não foi possível consultar os clientes", 503);
    }
  }

  async get(userId: string, customerId: string) {
    userId = z.string().trim().min(1).parse(userId);
    customerId = customerIdSchema.parse(customerId);
    const ordersWhere = orderFilter(userId);
    let row: CustomerRow | null;
    try {
      row = await this.readTransaction((tx) => tx.customer.findFirst({
        where: { id: customerId, orders: { some: ordersWhere } },
        select: customerSelect(ordersWhere),
      }));
    } catch {
      throw new AppError("Não foi possível consultar o cliente", 503);
    }
    if (!row) throw new AppError("Cliente não encontrado", 404);
    return toCustomerResult(row);
  }
}
