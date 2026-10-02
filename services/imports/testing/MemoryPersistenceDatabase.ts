import { Prisma } from "../../../generated/prisma/client";
import type { Customer, Invoice, Order, OrderItem } from "../../../generated/prisma/client";
import type { PersistenceTransactionRunner } from "../ImportedOrderPersistenceService";

interface Account {
  id: string;
  userId: string;
  platform: "MERCADO_LIVRE" | "MAGALU";
  isActive: boolean;
}

export interface MemoryState {
  accounts: Account[];
  customers: Customer[];
  orders: Order[];
  invoices: Invoice[];
  items: OrderItem[];
}

function copy(state: MemoryState): MemoryState {
  return {
    accounts: state.accounts.map((row) => ({ ...row })),
    customers: state.customers.map((row) => ({ ...row })),
    orders: state.orders.map((row) => ({ ...row })),
    invoices: state.invoices.map((row) => ({ ...row })),
    items: state.items.map((row) => ({ ...row })),
  };
}

function databaseError(code: string): Error {
  return new Prisma.PrismaClientKnownRequestError("payload privado fictício", {
    code, clientVersion: "7.10.0",
  });
}

/** Double de testes: verifica o estado e rollback; não simula locks do PostgreSQL. */
export class MemoryPersistenceDatabase {
  state: MemoryState = {
    accounts: [
      { id: "account-a", userId: "user-a", platform: "MERCADO_LIVRE", isActive: true },
      { id: "account-b", userId: "user-a", platform: "MERCADO_LIVRE", isActive: true },
      { id: "account-other-user", userId: "user-b", platform: "MERCADO_LIVRE", isActive: true },
    ],
    customers: [], orders: [], invoices: [], items: [],
  };
  transactionAttempts = 0;
  failuresBeforeCommit: string[] = [];
  failItemWrite = false;
  private sequence = 0;

  readonly runTransaction: PersistenceTransactionRunner = async <T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> => {
    this.transactionAttempts++;
    const pending = copy(this.state);
    const result = await work(this.transaction(pending));
    const failure = this.failuresBeforeCommit.shift();
    if (failure) throw databaseError(failure);
    this.state = pending;
    return result;
  };

  private id(prefix: string): string {
    return `${prefix}-${++this.sequence}`;
  }

  private transaction(state: MemoryState): Prisma.TransactionClient {
    const now = () => new Date(1_790_856_000_000 + this.sequence);
    const tx = {
      marketplaceAccount: {
        findFirst: async ({ where }: { where: Account }) => state.accounts.find((account) =>
          account.id === where.id && account.userId === where.userId &&
          account.platform === where.platform && account.isActive === where.isActive,
        ) ?? null,
      },
      customer: {
        findMany: async ({ where }: { where: {
          normalizedPhone: string;
          id?: { not: string };
          orders: { some: { marketplaceAccount: { userId: string } } };
        } }) => state.customers.filter((customer) =>
          customer.normalizedPhone === where.normalizedPhone && customer.id !== where.id?.not &&
          state.orders.some((order) => order.customerId === customer.id &&
            state.accounts.some((account) => account.id === order.marketplaceAccountId &&
              account.userId === where.orders.some.marketplaceAccount.userId)),
        ),
        create: async ({ data }: { data: Pick<Customer, "name" | "phone" | "normalizedPhone" | "document" | "documentType"> }) => {
          const customer: Customer = { ...data, id: this.id("customer"), createdAt: now(), updatedAt: now() };
          state.customers.push(customer);
          return customer;
        },
        update: async ({ where, data }: {
          where: { id: string };
          data: Partial<Pick<Customer, "name" | "phone" | "normalizedPhone" | "document" | "documentType">>;
        }) => {
          const index = state.customers.findIndex((row) => row.id === where.id);
          const previous = state.customers[index];
          if (!previous) throw databaseError("P2025");
          const customer = { ...previous, ...data, updatedAt: now() };
          state.customers[index] = customer;
          return customer;
        },
      },
      order: {
        findUnique: async ({ where }: { where: { marketplaceAccountId_externalOrderId: {
          marketplaceAccountId: string; externalOrderId: string;
        } } }) => {
          const key = where.marketplaceAccountId_externalOrderId;
          const order = state.orders.find((row) => row.marketplaceAccountId === key.marketplaceAccountId &&
            row.externalOrderId === key.externalOrderId);
          if (!order) return null;
          const customer = state.customers.find((row) => row.id === order.customerId);
          if (!customer) throw databaseError("P2003");
          return {
            ...order,
            customer: { ...customer, _count: { orders: state.orders.filter((row) =>
              row.customerId === customer.id).length } },
          };
        },
        create: async ({ data }: { data: Omit<Order, "id" | "createdAt" | "updatedAt"> }) => {
          if (state.orders.some((row) => row.marketplaceAccountId === data.marketplaceAccountId &&
            row.externalOrderId === data.externalOrderId)) throw databaseError("P2002");
          const order = { ...data, id: this.id("order"), createdAt: now(), updatedAt: now() };
          state.orders.push(order);
          return order;
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Order> }) => {
          const index = state.orders.findIndex((row) => row.id === where.id);
          const previous = state.orders[index];
          if (!previous) throw databaseError("P2025");
          const order = { ...previous, ...data, updatedAt: now() };
          state.orders[index] = order;
          return order;
        },
      },
      invoice: {
        findUnique: async ({ where }: { where: { invoiceKey: string } }) =>
          state.invoices.find((row) => row.invoiceKey === where.invoiceKey) ?? null,
        create: async ({ data }: { data: Omit<Invoice, "id" | "processedAt"> }) => {
          if (state.invoices.some((row) => row.invoiceKey === data.invoiceKey)) throw databaseError("P2002");
          const invoice = { ...data, id: this.id("invoice"), processedAt: now() };
          state.invoices.push(invoice);
          return invoice;
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Invoice> }) => {
          const index = state.invoices.findIndex((row) => row.id === where.id);
          const previous = state.invoices[index];
          if (!previous) throw databaseError("P2025");
          const invoice = { ...previous, ...data };
          state.invoices[index] = invoice;
          return invoice;
        },
      },
      orderItem: {
        findMany: async ({ where }: { where: { orderId: string } }) =>
          state.items.filter((row) => row.orderId === where.orderId),
        deleteMany: async ({ where }: { where: { orderId: string } }) => {
          const previous = state.items.length;
          state.items = state.items.filter((row) => row.orderId !== where.orderId);
          return { count: previous - state.items.length };
        },
        createMany: async ({ data }: { data: (Omit<OrderItem, "id" | "unitPrice"> & {
          unitPrice: string | null;
        })[] }) => {
          if (this.failItemWrite) throw databaseError("P2003");
          for (const item of data) state.items.push({
            ...item, id: this.id("item"),
            unitPrice: item.unitPrice === null ? null : new Prisma.Decimal(item.unitPrice),
          });
          return { count: data.length };
        },
      },
    };

    // Os delegates completos do Prisma são genéricos e têm métodos fora deste double.
    // O serviço de produção continua checado contra Prisma.TransactionClient.
    return tx as unknown as Prisma.TransactionClient;
  }
}
