"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportedOrderPersistenceService = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const client_1 = require("../../generated/prisma/client");
const prisma_1 = require("../../lib/prisma");
const normalizePhone_1 = require("../../utils/normalizePhone");
const normalizeDocument_1 = require("../../utils/normalizeDocument");
const MAX_TRANSACTION_ATTEMPTS = 4;
const nameSchema = zod_1.z.string().nullable().transform((value) => value?.trim().replace(/\s+/g, " ") || null);
const phoneSchema = zod_1.z.string().nullable().transform(normalizePhone_1.normalizePhone);
const documentFields = {
    document: zod_1.z.string().nullable().optional(),
    documentType: zod_1.z.enum(["CPF", "CNPJ"]).nullable().optional(),
};
const itemSchema = zod_1.z.object({
    externalProductId: zod_1.z.string().trim().min(1).nullable(),
    productName: zod_1.z.string().trim().min(1),
    quantity: zod_1.z.number().int().min(0).max(2_147_483_647),
    unitPrice: zod_1.z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/).nullable(),
}).strict();
const inputSchema = zod_1.z.object({
    marketplaceAccountId: zod_1.z.string().trim().min(1),
    userId: zod_1.z.string().trim().min(1),
    order: zod_1.z.object({
        externalOrderId: zod_1.z.string().trim().min(1),
        platform: zod_1.z.enum(["MERCADO_LIVRE", "MAGALU"]),
        orderDate: zod_1.z.date().nullable(),
        status: zod_1.z.string().trim().min(1).nullable(),
        customer: zod_1.z.object({ name: nameSchema, phone: phoneSchema, ...documentFields }).strict()
            .transform((customer) => ({ ...customer,
            ...(0, normalizeDocument_1.normalizeCustomerDocument)(customer.document, customer.documentType),
        })),
        items: zod_1.z.array(itemSchema),
    }).strict(),
    invoice: zod_1.z.object({
        invoiceKey: zod_1.z.string().regex(/^\d{44}$/),
        invoiceNumber: zod_1.z.string().regex(/^\d{1,9}$/),
        customerName: nameSchema,
        phone: phoneSchema,
        ...documentFields,
    }).strict().nullable().optional(),
}).strict();
const customerSelect = {
    id: true,
    name: true,
    phone: true,
    normalizedPhone: true,
    document: true,
    documentType: true,
    createdAt: true,
    updatedAt: true,
};
function sameName(left, right) {
    return left !== null && right !== null &&
        left.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR") ===
            right.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}
/** Persiste um pedido normalizado inteiro; não consulta APIs nem processa XML. */
class ImportedOrderPersistenceService {
    runTransaction;
    sleepFn;
    constructor(dependencies = {}) {
        this.runTransaction = dependencies.runTransaction ??
            ((work) => prisma_1.prisma.$transaction(work, {
                isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
                maxWait: 5_000,
                timeout: 15_000,
            }));
        this.sleepFn = dependencies.sleepFn ??
            ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    }
    async execute(input) {
        const validated = inputSchema.safeParse(input);
        if (!validated.success) {
            throw new AppError_1.AppError("Dados do pedido importado inválidos", 422);
        }
        for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt++) {
            try {
                return await this.runTransaction((tx) => this.persist(tx, validated.data));
            }
            catch (error) {
                if (error instanceof AppError_1.AppError)
                    throw error;
                if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                    if (error.code === "P2034" || error.code === "P2002") {
                        if (attempt + 1 < MAX_TRANSACTION_ATTEMPTS) {
                            await this.sleepFn(50 * 2 ** attempt);
                            continue;
                        }
                        throw new AppError_1.AppError("Houve um conflito ao salvar o pedido importado. Tente novamente", 409);
                    }
                }
                // Mensagens do Prisma podem incluir valores pessoais do payload.
                throw new AppError_1.AppError("Não foi possível salvar o pedido importado", 500);
            }
        }
        throw new AppError_1.AppError("Não foi possível salvar o pedido importado", 500);
    }
    async persist(tx, input) {
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
            throw new AppError_1.AppError("Conta de marketplace não encontrada ou inativa", 404);
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
        const orderData = {};
        if (existing && customer.id !== existing.customerId)
            orderData.customerId = customer.id;
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
        const invoiceId = input.invoice
            ? await this.persistInvoice(tx, order.id, input.invoice)
            : null;
        await this.syncItems(tx, order.id, input.order.items);
        return {
            orderId: order.id,
            customerId: customer.id,
            invoiceId,
            created: existing === null,
            itemsCount: input.order.items.length,
            customerHasPhone: customer.normalizedPhone !== null,
        };
    }
    async resolveCustomer(tx, input, existing) {
        const incoming = input.order.customer;
        // O vínculo do próprio pedido pode ser mantido mesmo sem telefone.
        const nameCompatible = !incoming.name || !existing?.name || sameName(incoming.name, existing.name);
        const phoneUnchanged = !incoming.phone || incoming.phone === existing?.normalizedPhone;
        const documentCompatible = !incoming.document || !existing?.document || incoming.document === existing.document;
        if (existing && nameCompatible && phoneUnchanged && documentCompatible) {
            return this.updateCustomer(tx, existing, incoming);
        }
        const compatible = await this.findCompatibleCustomer(tx, input.userId, incoming.name, incoming.phone, incoming.document, existing?.id);
        if (compatible)
            return this.updateCustomer(tx, compatible, incoming);
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
    async findCompatibleCustomer(tx, userId, name, normalizedPhone, document, excludeId) {
        if (!normalizedPhone || !name)
            return null;
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
    async updateCustomer(tx, existing, incoming) {
        const data = {};
        if (incoming.name !== null && incoming.name !== existing.name)
            data.name = incoming.name;
        if (incoming.phone !== null) {
            if (incoming.phone !== existing.phone)
                data.phone = incoming.phone;
            if (incoming.phone !== existing.normalizedPhone)
                data.normalizedPhone = incoming.phone;
        }
        if (incoming.document !== null) {
            if (incoming.document !== existing.document)
                data.document = incoming.document;
            if (incoming.documentType !== existing.documentType)
                data.documentType = incoming.documentType;
        }
        return Object.keys(data).length === 0
            ? existing
            : tx.customer.update({ where: { id: existing.id }, data, select: customerSelect });
    }
    async persistInvoice(tx, orderId, invoice) {
        const existing = await tx.invoice.findUnique({ where: { invoiceKey: invoice.invoiceKey } });
        if (existing && existing.orderId !== orderId) {
            throw new AppError_1.AppError("A NF-e já está associada a outro pedido", 409);
        }
        const data = {};
        if (invoice.invoiceNumber !== existing?.invoiceNumber)
            data.invoiceNumber = invoice.invoiceNumber;
        if (invoice.customerName !== null && invoice.customerName !== existing?.customerName) {
            data.customerName = invoice.customerName;
        }
        if (invoice.phone !== null && invoice.phone !== existing?.phone)
            data.phone = invoice.phone;
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
    async syncItems(tx, orderId, items) {
        const existing = await tx.orderItem.findMany({ where: { orderId } });
        const signature = (item) => JSON.stringify([
            item.externalProductId, item.productName, item.quantity,
            item.unitPrice === null ? null : new client_1.Prisma.Decimal(item.unitPrice).toFixed(2),
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
exports.ImportedOrderPersistenceService = ImportedOrderPersistenceService;
//# sourceMappingURL=ImportedOrderPersistenceService.js.map