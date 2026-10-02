import assert from "node:assert/strict";

import type { Prisma } from "../../../generated/prisma/client";
import type { CustomerReadTransaction } from "../CustomerQueryService";

export const fixtureId = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;

interface CustomerFixture {
  id: string;
  name: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  document?: string | null;
  documentType?: "CPF" | "CNPJ" | null;
}

interface AccountFixture {
  id: string;
  userId: string | null;
  name: string;
  cnpj: string | null;
  isActive: boolean;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
}

interface OrderFixture {
  id: string;
  customerId: string;
  marketplaceAccountId: string;
  platform: "MERCADO_LIVRE" | "MAGALU";
  externalOrderId: string;
  orderDate: Date | null;
  createdAt: Date;
}

function matchesText(value: string | null, predicate: unknown): boolean {
  if (predicate === undefined) return true;
  if (predicate === null || typeof predicate === "string") return value === predicate;
  const filter = predicate as { contains?: string; not?: string | null; mode?: string };
  if ("not" in filter && value === filter.not) return false;
  if (filter.contains !== undefined) {
    if (value === null) return false;
    const text = filter.contains.replace(/\\([\\%_])/g, "$1");
    return filter.mode === "insensitive"
      ? value.toLowerCase().includes(text.toLowerCase()) : value.includes(text);
  }
  return true;
}

/** Avalia apenas os filtros usados nestas consultas; não substitui PostgreSQL. */
export class MemoryCustomerQueryDatabase {
  calls = { count: 0, findMany: 0, findFirst: 0, transactions: 0 };
  lastFindMany: Prisma.CustomerFindManyArgs | undefined;
  lastCount: Prisma.CustomerCountArgs | undefined;
  lastFindFirst: Prisma.CustomerFindFirstArgs | undefined;
  fail = false;

  customers: CustomerFixture[] = [
    { id: fixtureId(1), name: "Maria Fictícia", phone: "5511999990000", normalizedPhone: "5511999990000" },
    { id: fixtureId(2), name: "João Fictício", phone: null, normalizedPhone: null },
    { id: fixtureId(3), name: "Ana Fictícia", phone: "5521888880000", normalizedPhone: "5521888880000" },
    { id: fixtureId(4), name: "Pessoa de outro usuário", phone: "5511999990000", normalizedPhone: "5511999990000" },
    { id: fixtureId(5), name: "Cliente sem pedidos", phone: null, normalizedPhone: null },
    { id: fixtureId(6), name: "Zélia Fictícia", phone: null, normalizedPhone: null },
    { id: fixtureId(7), name: null, phone: null, normalizedPhone: null },
  ];
  accounts: AccountFixture[] = [10, 20, 30, 40].map((number) => ({
    id: fixtureId(number), userId: number === 30 ? "user-b" : "user-a",
    name: `Conta fictícia ${number}`, cnpj: null, isActive: number !== 40,
    accessTokenEncrypted: "token-acesso-ficticio-nao-expor",
    refreshTokenEncrypted: "token-renovacao-ficticio-nao-expor",
  }));
  orders: OrderFixture[] = [
    this.order(101, 1, 10, "ML-100", "2026-09-05"),
    this.order(102, 1, 20, "MAG-200", "2026-09-20", "MAGALU"),
    this.order(103, 1, 30, "SECRET-900", "2026-10-01"),
    this.order(104, 2, 10, "ML-101", "2026-09-15"),
    this.order(105, 3, 20, "MAG-201", "2026-09-25", "MAGALU"),
    this.order(106, 4, 30, "OUTRO-300", "2026-09-10"),
    this.order(107, 6, 40, "ML-OLD", "2026-09-18"),
    this.order(108, 7, 10, "ML-SEM-DATA", null),
  ];

  private order(
    id: number, customerId: number, accountId: number, externalOrderId: string,
    date: string | null, platform: OrderFixture["platform"] = "MERCADO_LIVRE",
  ): OrderFixture {
    return {
      id: fixtureId(id), customerId: fixtureId(customerId), marketplaceAccountId: fixtureId(accountId),
      externalOrderId, platform, orderDate: date ? new Date(`${date}T12:00:00Z`) : null,
      createdAt: new Date("2026-10-01T12:00:00Z"),
    };
  }

  private matchesOrder(order: OrderFixture, where: Prisma.OrderWhereInput): boolean {
    const account = this.accounts.find((row) => row.id === order.marketplaceAccountId);
    if (!account) return false;
    const accountWhere = where.marketplaceAccount as Prisma.MarketplaceAccountWhereInput | undefined;
    if (accountWhere && !matchesText(account.userId, accountWhere.userId)) return false;
    if (!matchesText(order.platform, where.platform) ||
        !matchesText(order.marketplaceAccountId, where.marketplaceAccountId) ||
        !matchesText(order.externalOrderId, where.externalOrderId)) return false;
    if (where.orderDate) {
      const date = where.orderDate as { gte?: Date; lte?: Date };
      if (!order.orderDate || date.gte && order.orderDate < date.gte || date.lte && order.orderDate > date.lte) return false;
    }
    if (where.customer) {
      const customer = this.customers.find((row) => row.id === order.customerId);
      if (!customer || !this.matchesCustomer(customer, where.customer as Prisma.CustomerWhereInput)) return false;
    }
    if (where.OR && !where.OR.some((condition) => this.matchesOrder(order, condition))) return false;
    return true;
  }

  private matchesCustomer(customer: CustomerFixture, where: Prisma.CustomerWhereInput = {}): boolean {
    if (!matchesText(customer.id, where.id) || !matchesText(customer.name, where.name) ||
        !matchesText(customer.phone, where.phone) || !matchesText(customer.normalizedPhone, where.normalizedPhone) ||
        !matchesText(customer.document ?? null, where.document)) return false;
    if (where.AND) {
      const conditions = Array.isArray(where.AND) ? where.AND : [where.AND];
      if (!conditions.every((condition) => this.matchesCustomer(customer, condition))) return false;
    }
    if (where.OR && !where.OR.some((condition) => this.matchesCustomer(customer, condition))) return false;
    if (where.orders?.some && !this.orders.some((order) => order.customerId === customer.id &&
        this.matchesOrder(order, where.orders!.some!))) return false;
    return true;
  }

  private project(customer: CustomerFixture, select: Prisma.CustomerSelect | null | undefined) {
    assert.ok(select && typeof select.orders === "object");
    const ordersSelection = select.orders;
    assert.deepEqual(Object.keys(select).sort(), ["document", "documentType", "id", "name", "normalizedPhone", "orders", "phone"]);
    assert.equal(ordersSelection.take, 1);
    const orderSelect = ordersSelection.select;
    assert.ok(orderSelect && typeof orderSelect.marketplaceAccount === "object");
    assert.deepEqual(Object.keys(orderSelect.marketplaceAccount.select!).sort(), ["cnpj", "id", "name"]);
    const orders = this.orders.filter((order) => order.customerId === customer.id &&
      this.matchesOrder(order, ordersSelection.where ?? {}));
    orders.sort((left, right) => {
      if (left.orderDate === null && right.orderDate !== null) return 1;
      if (right.orderDate === null && left.orderDate !== null) return -1;
      return (right.orderDate?.getTime() ?? 0) - (left.orderDate?.getTime() ?? 0) ||
        right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id);
    });
    return {
      ...customer,
      document: customer.document ?? null,
      documentType: customer.documentType ?? null,
      orders: orders.slice(0, ordersSelection.take).map((order) => ({
        ...order,
        // Devolve extras fictícios para também verificar a proteção do DTO.
        marketplaceAccount: this.accounts.find((account) => account.id === order.marketplaceAccountId),
      })),
    };
  }

  readonly readTransaction: CustomerReadTransaction = async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
    this.calls.transactions++;
    if (this.fail) throw new Error("SQL contendo valores privados fictícios");
    const tx = {
      customer: {
        count: async (args: Prisma.CustomerCountArgs) => {
          this.calls.count++;
          this.lastCount = args;
          return this.customers.filter((row) => this.matchesCustomer(row, args.where)).length;
        },
        findMany: async (args: Prisma.CustomerFindManyArgs) => {
          this.calls.findMany++;
          this.lastFindMany = args;
          assert.deepEqual(args.orderBy, [{ name: { sort: "asc", nulls: "last" } }, { id: "asc" }]);
          const rows = this.customers.filter((row) => this.matchesCustomer(row, args.where));
          rows.sort((left, right) => {
            if (left.name === null && right.name !== null) return 1;
            if (right.name === null && left.name !== null) return -1;
            return (left.name ?? "").localeCompare(right.name ?? "") || left.id.localeCompare(right.id);
          });
          return rows.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? rows.length)).map((row) => this.project(row, args.select));
        },
        findFirst: async (args: Prisma.CustomerFindFirstArgs) => {
          this.calls.findFirst++;
          this.lastFindFirst = args;
          const row = this.customers.find((customer) => this.matchesCustomer(customer, args.where));
          return row ? this.project(row, args.select) : null;
        },
      },
    };
    return work(tx as unknown as Prisma.TransactionClient);
  };
}
