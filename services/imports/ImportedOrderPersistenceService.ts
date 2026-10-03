import { z } from "zod";

import { AppError } from "../../errors/AppError";
import { Prisma } from "../../generated/prisma/client";
import type { Customer } from "../../generated/prisma/client";
import type { MarketplaceOrder } from "../../integrations/types";
import { prisma } from "../../lib/prisma";
import { normalizePhone } from "../../utils/normalizePhone";
import { normalizeCustomerDocument } from "../../utils/normalizeDocument";
import type { ParsedNFeData } from "../invoices/NFeParserService";

const MAX_TRANSACTION_ATTEMPTS = 4;

const nameSchema = z.string().nullable().transform((value) =>
  value?.trim().replace(/\s+/g, " ") || null,
);
const phoneSchema = z.string().nullable().transform(normalizePhone);
const documentFields = {
  document: z.string().nullable().optional(),
  documentType: z.enum(["CPF", "CNPJ"]).nullable().optional(),
};
const itemSchema = z.object({
  externalProductId: z.string().trim().min(1).nullable(),
  productName: z.string().trim().min(1),
  quantity: z.number().int().min(0).max(2_147_483_647),
  unitPrice: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/).nullable(),
}).strict();

const invoiceSchema = z.object({
  invoiceKey: z.string().regex(/^\d{44}$/),
  invoiceNumber: z.string().regex(/^\d{1,9}$/),
  customerName: nameSchema,
  phone: phoneSchema,
  ...documentFields,
}).strict();

const inputSchema = z.object({
  marketplaceAccountId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  order: z.object({
    externalOrderId: z.string().trim().min(1),
    platform: z.enum(["MERCADO_LIVRE", "MAGALU"]),
    orderDate: z.date().nullable(),
    status: z.string().trim().min(1).nullable(),
    customer: z.object({ name: nameSchema, phone: phoneSchema, ...documentFields }).strict()
      .transform((customer) => ({ ...customer,
        ...normalizeCustomerDocument(customer.document, customer.documentType),
      })),
    items: z.array(itemSchema),
  }).strict(),
  invoice: invoiceSchema.nullable().optional(),
  invoices: z.array(invoiceSchema).optional(),
}).strict().refine(input => input.invoice == null || input.invoices === undefined,
  "Informe invoice ou invoices, sem combinar os dois formatos");

type ValidatedInput = z.infer<typeof inputSchema>;
type CustomerWithOrderCount = Customer & { _count: { orders: number } };

export interface PersistImportedOrderInput {
  marketplaceAccountId: string;
  userId: string;
  order: MarketplaceOrder;
  invoice?: ParsedNFeData | null;
  /** Notas já processadas do mesmo pedido; alternativa ao campo invoice. */
  invoices?: ParsedNFeData[];
}

export interface PersistImportedOrderResult {
  orderId: string;
  customerId: string;
  invoiceId: string | null;
  /** Presente quando a entrada utiliza invoices; IDs únicos das notas recebidas. */
  invoiceIds?: string[];
  created: boolean;
  itemsCount: number;
  customerHasPhone: boolean;
}

export type PersistenceTransactionRunner = <T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) => Promise<T>;

interface PersistenceDependencies {
  runTransaction?: PersistenceTransactionRunner;
  sleepFn?: (milliseconds: number) => Promise<void>;
}

const customerSelect = {
  id: true,
  name: true,
  phone: true,
  normalizedPhone: true,
  document: true,
  documentType: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerSelect;

function sameName(left: string | null, right: string | null): boolean {
  return left !== null && right !== null &&
    left.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR") ===
    right.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

/** Persiste um pedido normalizado inteiro; não consulta APIs nem processa XML. */
export class ImportedOrderPersistenceService {
  private readonly runTransaction: PersistenceTransactionRunner;
  private readonly sleepFn: (milliseconds: number) => Promise<void>;

  constructor(dependencies: PersistenceDependencies = {}) {
    this.runTransaction = dependencies.runTransaction ??
      ((work) => prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      }));
    this.sleepFn = dependencies.sleepFn ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async execute(input: PersistImportedOrderInput): Promise<PersistImportedOrderResult> {
    const validated = inputSchema.safeParse(input);
    if (!validated.success) {
      throw new AppError("Dados do pedido importado inválidos", 422);
    }

    for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt++) {
      try {
        return await this.runTransaction((tx) => this.persist(tx, validated.data));
      } catch (error) {
        if (error instanceof AppError) throw error;

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2034" || error.code === "P2002") {
            if (attempt + 1 < MAX_TRANSACTION_ATTEMPTS) {
              await this.sleepFn(50 * 2 ** attempt);
              continue;
            }
            throw new AppError(
              "Houve um conflito ao salvar o pedido importado. Tente novamente",
              409,
            );
          }
        }

        // Mensagens do Prisma podem incluir valores pessoais do payload.
        throw new AppError("Não foi possível salvar o pedido importado", 500);
      }
    }

    throw new AppError("Não foi possível salvar o pedido importado", 500);
  }

  private async persist(
    tx: Prisma.TransactionClient,
    input: ValidatedInput,
  ): Promise<PersistImportedOrderResult> {
    const account = await tx.marketplaceAccount.findFirst({
      where: {
        id: input.marketplaceAccountId,
        userId: input.userId,
        platform: input.order.platform,
        isActive: true,
      },
      select: { id: true },
    });
    if (!account) {
      throw new AppError("Conta de marketplace não encontrada ou inativa", 404);
    }

    const existing = await tx.order.findUnique({
      where: {
        marketplaceAccountId_externalOrderId: {
          marketplaceAccountId: account.id,
          externalOrderId: input.order.externalOrderId,
        },
      },
      include: {
        customer: { select: { ...customerSelect, _count: { select: { orders: true } } } },
      },
    });

    const customer = await this.resolveCustomer(tx, input, existing?.customer ?? null);
    const orderData: Prisma.OrderUncheckedUpdateInput = {};
    if (existing && customer.id !== existing.customerId) orderData.customerId = customer.id;
    if (input.order.orderDate !== null && input.order.orderDate.getTime() !== existing?.orderDate?.getTime()) {
      orderData.orderDate = input.order.orderDate;
    }
    if (input.order.status !== null && input.order.status !== existing?.status) {
      orderData.status = input.order.status;
    }

    const order = existing
      ? Object.keys(orderData).length === 0
        ? existing
        : await tx.order.update({ where: { id: existing.id }, data: orderData })
      : await tx.order.create({
          data: {
            customerId: customer.id,
            orderDate: input.order.orderDate,
            status: input.order.status,
            platform: input.order.platform,
            marketplaceAccountId: account.id,
            externalOrderId: input.order.externalOrderId,
          },
        });

    const invoiceIds: string[] = [];
    for (const invoice of input.invoices ?? (input.invoice ? [input.invoice] : [])) {
      const invoiceId = await this.persistInvoice(tx, order.id, invoice);
      if (!invoiceIds.includes(invoiceId)) invoiceIds.push(invoiceId);
    }
    await this.syncItems(tx, order.id, input.order.items);

    return {
      orderId: order.id,
      customerId: customer.id,
      invoiceId: invoiceIds[0] ?? null,
      ...(input.invoices === undefined ? {} : { invoiceIds }),
      created: existing === null,
      itemsCount: input.order.items.length,
      customerHasPhone: customer.normalizedPhone !== null,
    };
  }

  private async resolveCustomer(
    tx: Prisma.TransactionClient,
    input: ValidatedInput,
    existing: CustomerWithOrderCount | null,
  ): Promise<Customer> {
    const incoming = input.order.customer;

    // O vínculo do próprio pedido pode ser mantido mesmo sem telefone.
    const nameCompatible = !incoming.name || !existing?.name || sameName(incoming.name, existing.name);
    const phoneUnchanged = !incoming.phone || incoming.phone === existing?.normalizedPhone;
    const documentCompatible = !incoming.document || !existing?.document || incoming.document === existing.document;
    if (existing && nameCompatible && phoneUnchanged && documentCompatible) {
      return this.updateCustomer(tx, existing, incoming);
    }

    const compatible = await this.findCompatibleCustomer(
      tx, input.userId, incoming.name, incoming.phone, incoming.document, existing?.id,
    );
    if (compatible) return this.updateCustomer(tx, compatible, incoming);

    // Correções no pedido não devem alterar o cliente compartilhado de outras vendas.
    if (existing && existing._count.orders === 1) {
      return this.updateCustomer(tx, existing, incoming);
    }

    return tx.customer.create({
      data: {
        name: incoming.name,
        phone: incoming.phone,
        normalizedPhone: incoming.phone,
        document: incoming.document,
        documentType: incoming.documentType,
      },
      select: customerSelect,
    });
  }

  private async findCompatibleCustomer(
    tx: Prisma.TransactionClient,
    userId: string,
    name: string | null,
    normalizedPhone: string | null,
    document: string | null,
    excludeId?: string,
  ): Promise<Customer | null> {
    if (!normalizedPhone || !name) return null;

    const candidates = await tx.customer.findMany({
      where: {
        normalizedPhone,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        orders: { some: { marketplaceAccount: { userId } } },
      },
      select: customerSelect,
    });
    const compatible = candidates.filter((customer) => sameName(customer.name, name) &&
      (!document || !customer.document || document === customer.document));

    // Havendo ambiguidade, criar outro registro é mais seguro que unir pessoas.
    return compatible.length === 1 ? compatible[0] ?? null : null;
  }

  private async updateCustomer(
    tx: Prisma.TransactionClient,
    existing: Customer,
    incoming: ValidatedInput["order"]["customer"],
  ): Promise<Customer> {
    const data: Prisma.CustomerUpdateInput = {};
    if (incoming.name !== null && incoming.name !== existing.name) data.name = incoming.name;
    if (incoming.phone !== null) {
      if (incoming.phone !== existing.phone) data.phone = incoming.phone;
      if (incoming.phone !== existing.normalizedPhone) data.normalizedPhone = incoming.phone;
    }
    if (incoming.document !== null) {
      if (incoming.document !== existing.document) data.document = incoming.document;
      if (incoming.documentType !== existing.documentType) data.documentType = incoming.documentType;
    }

    return Object.keys(data).length === 0
      ? existing
      : tx.customer.update({ where: { id: existing.id }, data, select: customerSelect });
  }

  private async persistInvoice(
    tx: Prisma.TransactionClient,
    orderId: string,
    invoice: NonNullable<ValidatedInput["invoice"]>,
  ): Promise<string> {
    const existing = await tx.invoice.findUnique({ where: { invoiceKey: invoice.invoiceKey } });
    if (existing && existing.orderId !== orderId) {
      throw new AppError("A NF-e já está associada a outro pedido", 409);
    }

    const data: Prisma.InvoiceUpdateInput = {};
    if (invoice.invoiceNumber !== existing?.invoiceNumber) data.invoiceNumber = invoice.invoiceNumber;
    if (invoice.customerName !== null && invoice.customerName !== existing?.customerName) {
      data.customerName = invoice.customerName;
    }
    if (invoice.phone !== null && invoice.phone !== existing?.phone) data.phone = invoice.phone;
    const saved = existing
      ? Object.keys(data).length === 0
        ? existing
        : await tx.invoice.update({ where: { id: existing.id }, data })
      : await tx.invoice.create({
          data: {
            invoiceKey: invoice.invoiceKey,
            orderId,
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customerName,
            phone: invoice.phone,
          },
        });
    return saved.id;
  }

  private async syncItems(
    tx: Prisma.TransactionClient,
    orderId: string,
    items: ValidatedInput["order"]["items"],
  ): Promise<void> {
    const existing = await tx.orderItem.findMany({ where: { orderId } });
    const signature = (item: {
      externalProductId: string | null;
      productName: string;
      quantity: number;
      unitPrice: string | Prisma.Decimal | null;
    }) => JSON.stringify([
      item.externalProductId, item.productName, item.quantity,
      item.unitPrice === null ? null : new Prisma.Decimal(item.unitPrice).toFixed(2),
    ]);

    const previous = existing.map(signature).sort();
    const next = items.map(signature).sort();
    if (previous.length === next.length && previous.every((value, index) => value === next[index])) {
      return;
    }

    // items é a lista completa atual, não uma página nem uma atualização parcial.
    await tx.orderItem.deleteMany({ where: { orderId } });
    if (items.length > 0) {
      await tx.orderItem.createMany({ data: items.map((item) => ({ ...item, orderId })) });
    }
  }
}
