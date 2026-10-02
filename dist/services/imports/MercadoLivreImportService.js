"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoLivreImportService = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const mercadoLivreInvoiceService_1 = require("../../integrations/mercadolivre/mercadoLivreInvoiceService");
const mercadoLivreOrderService_1 = require("../../integrations/mercadolivre/mercadoLivreOrderService");
const mercadoLivreRecipientService_1 = require("../../integrations/mercadolivre/mercadoLivreRecipientService");
const MercadoLivreRequestLimiter_1 = require("../../integrations/mercadolivre/MercadoLivreRequestLimiter");
const mercadoLivreTokenService_1 = require("../../integrations/mercadolivre/mercadoLivreTokenService");
const CustomerExtractionService_1 = require("../customers/CustomerExtractionService");
const NFeParserService_1 = require("../invoices/NFeParserService");
const ImportedOrderPersistenceService_1 = require("./ImportedOrderPersistenceService");
const ImportRepository_1 = require("./ImportRepository");
const inputSchema = zod_1.z.object({
    marketplaceAccountId: zod_1.z.string().trim().min(1),
    userId: zod_1.z.string().trim().min(1),
    dateFrom: zod_1.z.date(), dateTo: zod_1.z.date(),
}).strict().refine((input) => input.dateFrom <= input.dateTo);
class MercadoLivreImportService {
    storage;
    orders;
    recipients;
    invoices;
    parser;
    persistence;
    concurrency;
    batchSize;
    nowFn;
    activeAccounts = new Set();
    constructor(dependencies = {}) {
        const tokenService = new mercadoLivreTokenService_1.MercadoLivreTokenService();
        const fetchFn = new MercadoLivreRequestLimiter_1.MercadoLivreRequestLimiter().fetch;
        this.storage = dependencies.storage ?? new ImportRepository_1.ImportRepository();
        this.orders = dependencies.orders ?? new mercadoLivreOrderService_1.MercadoLivreOrderService({ tokenService, fetchFn });
        this.recipients = dependencies.recipients ?? new mercadoLivreRecipientService_1.MercadoLivreRecipientService({ tokenService, fetchFn });
        this.invoices = dependencies.invoices ?? new mercadoLivreInvoiceService_1.MercadoLivreInvoiceService({ tokenService, fetchFn });
        this.parser = dependencies.parser ?? new NFeParserService_1.NFeParserService();
        this.persistence = dependencies.persistence ?? new ImportedOrderPersistenceService_1.ImportedOrderPersistenceService();
        this.concurrency = dependencies.concurrency ?? 3;
        this.batchSize = dependencies.batchSize ?? 20;
        this.nowFn = dependencies.nowFn ?? (() => new Date());
        if (!Number.isInteger(this.concurrency) || this.concurrency < 1 || this.concurrency > 10 ||
            !Number.isInteger(this.batchSize) || this.batchSize < 1 || this.batchSize > 50) {
            throw new Error("Configuração de lotes da importação inválida");
        }
    }
    async execute(input) {
        const parsed = inputSchema.safeParse(input);
        if (!parsed.success)
            throw new AppError_1.AppError("Dados da importação inválidos", 400);
        input = parsed.data;
        let ownsAccount;
        try {
            ownsAccount = await this.storage.ownsActiveAccount(input.marketplaceAccountId, input.userId);
        }
        catch {
            throw new AppError_1.AppError("Não foi possível validar a conta do Mercado Livre", 503);
        }
        if (!ownsAccount) {
            throw new AppError_1.AppError("Conta do Mercado Livre não encontrada para este usuário ou inativa", 404);
        }
        if (this.activeAccounts.has(input.marketplaceAccountId)) {
            throw new AppError_1.AppError("Já existe uma importação em andamento para esta conta", 409);
        }
        this.activeAccounts.add(input.marketplaceAccountId);
        try {
            return await this.run(input);
        }
        catch (error) {
            if (error instanceof AppError_1.AppError)
                throw error;
            // Nunca repassar mensagens do banco ou payloads externos ao tratamento HTTP.
            throw new AppError_1.AppError("Não foi possível registrar o resultado da importação", 503);
        }
        finally {
            this.activeAccounts.delete(input.marketplaceAccountId);
        }
    }
    async run(input) {
        const record = await this.storage.create(input.marketplaceAccountId);
        const counters = {
            ordersFound: 0, ordersProcessed: 0, customersWithPhone: 0,
            customersWithoutPhone: 0, errorsCount: 0,
        };
        const seen = new Set();
        try {
            for await (const page of this.orders.getOrders({
                ...input,
                onOrderError: () => { counters.ordersFound++; counters.errorsCount++; },
            })) {
                const unique = page.filter((order) => {
                    if (seen.has(order.externalOrderId))
                        return false;
                    seen.add(order.externalOrderId);
                    return true;
                });
                counters.ordersFound += unique.length;
                await this.storage.update(record.id, { ...counters });
                for (let start = 0; start < unique.length; start += this.batchSize) {
                    await this.processBatch(unique.slice(start, start + this.batchSize), input, counters);
                    await this.storage.update(record.id, { ...counters });
                }
            }
        }
        catch {
            // Falha de paginação ou de registro do progresso; os pedidos já salvos permanecem válidos.
            counters.errorsCount++;
        }
        const status = counters.errorsCount === 0 ? "SUCCESS"
            : counters.ordersProcessed > 0 ? "PARTIAL_SUCCESS" : "ERROR";
        return this.storage.update(record.id, { ...counters, status, finishedAt: this.nowFn() });
    }
    async processBatch(batch, input, counters) {
        let index = 0;
        const worker = async () => {
            while (index < batch.length) {
                const order = batch[index++];
                if (!order)
                    continue;
                try {
                    const hasPhone = await this.processOrder(order, input);
                    counters.ordersProcessed++;
                    if (hasPhone)
                        counters.customersWithPhone++;
                    else
                        counters.customersWithoutPhone++;
                }
                catch {
                    counters.errorsCount++;
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(this.concurrency, batch.length) }, worker));
    }
    async processOrder(order, input) {
        let invoice = null;
        // Captura somente o resultado do parser, sem guardar o XML nem processá-lo duas vezes.
        const extraction = new CustomerExtractionService_1.CustomerExtractionService({
            parse: (xml) => { invoice = this.parser.parse(xml); return invoice; },
        });
        const customer = await extraction.extract({
            getRecipient: () => this.recipients.getRecipient(input.marketplaceAccountId, order),
            getInvoiceXml: () => this.invoices.getInvoiceXml({
                marketplaceAccountId: input.marketplaceAccountId,
                userId: input.userId, externalOrderId: order.externalOrderId,
            }),
        });
        const result = await this.persistence.execute({
            marketplaceAccountId: input.marketplaceAccountId, userId: input.userId,
            order: { ...order, customer }, invoice,
        });
        return result.customerHasPhone;
    }
}
exports.MercadoLivreImportService = MercadoLivreImportService;
//# sourceMappingURL=MercadoLivreImportService.js.map