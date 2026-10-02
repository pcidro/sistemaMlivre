"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoLivreInvoiceService = void 0;
const node_buffer_1 = require("node:buffer");
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const prisma_1 = require("../../lib/prisma");
const NFeParserService_1 = require("../../services/invoices/NFeParserService");
const mercadoLivreTokenService_1 = require("./mercadoLivreTokenService");
const API_BASE_URL = "https://api.mercadolibre.com";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_TRANSIENT_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 30_000;
const inputSchema = zod_1.z.object({
    marketplaceAccountId: zod_1.z.string().min(1),
    userId: zod_1.z.string().min(1),
    externalOrderId: zod_1.z.string().regex(/^\d+$/),
});
const invoiceSchema = zod_1.z.object({
    status: zod_1.z.string(),
    transaction_status: zod_1.z.string().nullable().optional(),
    attributes: zod_1.z
        .object({ xml_location: zod_1.z.string().nullable().optional() })
        .nullable()
        .optional(),
    xml_location: zod_1.z.string().nullable().optional(),
    fiscal_data: zod_1.z
        .object({ transaction_type: zod_1.z.string().nullable().optional() })
        .nullable()
        .optional(),
});
const invoiceResponseSchema = zod_1.z.union([invoiceSchema, zod_1.z.array(invoiceSchema)]);
/** Consulta apenas NF-e de venda; o XML retornado é transitório e não é persistido. */
class MercadoLivreInvoiceService {
    tokenService;
    fetchFn;
    findOwnedAccount;
    sleepFn;
    constructor(dependencies = {}) {
        this.tokenService =
            dependencies.tokenService ?? new mercadoLivreTokenService_1.MercadoLivreTokenService();
        this.fetchFn = dependencies.fetchFn ?? globalThis.fetch;
        this.findOwnedAccount =
            dependencies.findOwnedAccount ??
                ((marketplaceAccountId, userId) => prisma_1.prisma.marketplaceAccount.findFirst({
                    where: {
                        id: marketplaceAccountId,
                        userId,
                        platform: "MERCADO_LIVRE",
                        isActive: true,
                    },
                    select: { externalAccountId: true },
                }));
        this.sleepFn =
            dependencies.sleepFn ??
                ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    }
    async getInvoiceXml(input) {
        if (!inputSchema.safeParse(input).success) {
            throw new AppError_1.AppError("Dados de consulta da NF-e inválidos", 400);
        }
        const account = await this.findOwnedAccount(input.marketplaceAccountId, input.userId);
        if (!account) {
            throw new AppError_1.AppError("Conta do Mercado Livre não encontrada ou inativa", 404);
        }
        if (!/^\d+$/.test(account.externalAccountId)) {
            throw new AppError_1.AppError("Identificador da conta do Mercado Livre inválido", 502);
        }
        const context = {
            marketplaceAccountId: input.marketplaceAccountId,
            accessToken: await this.tokenService.getValidAccessToken(input.marketplaceAccountId),
        };
        const url = new URL(`/users/${account.externalAccountId}/invoices/orders/${input.externalOrderId}`, API_BASE_URL);
        const response = await this.request(url, context, "application/json");
        if (!response)
            return null;
        let invoices;
        try {
            const payload = invoiceResponseSchema.parse(await response.json());
            invoices = Array.isArray(payload) ? payload : [payload];
        }
        catch {
            throw new AppError_1.AppError("O Mercado Livre retornou dados inválidos para a NF-e", 502);
        }
        for (const invoice of invoices) {
            const type = invoice.fiscal_data?.transaction_type?.toLowerCase();
            if (type && type !== "sale")
                continue;
            if (invoice.status.toLowerCase() !== "authorized")
                continue;
            if (invoice.transaction_status &&
                invoice.transaction_status.toLowerCase() !== "authorized") {
                continue;
            }
            const location = invoice.attributes?.xml_location ?? invoice.xml_location;
            if (!location)
                continue;
            const xmlUrl = this.getOfficialXmlUrl(location, account.externalAccountId);
            const xmlResponse = await this.request(xmlUrl, context, "application/xml, text/xml");
            if (!xmlResponse)
                continue;
            return this.readXml(xmlResponse);
        }
        return null;
    }
    getOfficialXmlUrl(location, sellerId) {
        let url;
        try {
            url = new URL(location, API_BASE_URL);
        }
        catch {
            throw new AppError_1.AppError("O Mercado Livre retornou uma localização de XML inválida", 502);
        }
        // O bearer token só pode ir ao endpoint oficial de XML da própria conta.
        const expectedPath = new RegExp(`^/users/${sellerId}/invoices/documents/xml/\\d+/authorized$`);
        if (url.origin !== API_BASE_URL ||
            url.username ||
            url.password ||
            url.search ||
            url.hash ||
            !expectedPath.test(url.pathname)) {
            throw new AppError_1.AppError("O Mercado Livre retornou uma localização de XML inválida", 502);
        }
        return url;
    }
    async request(url, context, accept) {
        let refreshed = false;
        for (let attempt = 0; attempt < MAX_TRANSIENT_ATTEMPTS;) {
            let response;
            try {
                response = await this.fetchFn(url, {
                    method: "GET",
                    headers: {
                        Accept: accept,
                        Authorization: `Bearer ${context.accessToken}`,
                    },
                    redirect: "error",
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                });
            }
            catch {
                attempt += 1;
                if (attempt === MAX_TRANSIENT_ATTEMPTS) {
                    throw new AppError_1.AppError("A API de notas fiscais do Mercado Livre está indisponível", 503);
                }
                await this.waitBeforeRetry(attempt);
                continue;
            }
            if (response.status === 401 && !refreshed) {
                await this.discardResponse(response);
                context.accessToken = await this.tokenService.refreshAccessToken(context.marketplaceAccountId);
                refreshed = true;
                continue;
            }
            if (response.status === 204 || response.status === 404) {
                await this.discardResponse(response);
                return null;
            }
            if (response.status === 429 || response.status >= 500) {
                const retryAfter = response.headers.get("retry-after");
                await this.discardResponse(response);
                attempt += 1;
                if (attempt === MAX_TRANSIENT_ATTEMPTS) {
                    throw new AppError_1.AppError(response.status === 429
                        ? "Limite de consultas de notas fiscais excedido. Tente novamente mais tarde"
                        : "A API de notas fiscais do Mercado Livre está indisponível", response.status === 429 ? 429 : 503);
                }
                await this.waitBeforeRetry(attempt, retryAfter);
                continue;
            }
            if (!response.ok) {
                await this.discardResponse(response);
                throw new AppError_1.AppError(response.status === 401 || response.status === 403
                    ? "A conta não possui autorização para consultar esta NF-e"
                    : "Não foi possível consultar a NF-e no Mercado Livre", response.status === 401 || response.status === 403 ? 403 : 502);
            }
            return response;
        }
        throw new AppError_1.AppError("A API de notas fiscais do Mercado Livre está indisponível", 503);
    }
    async discardResponse(response) {
        try {
            await response.body?.cancel();
        }
        catch {
            // Uma falha ao descartar o corpo não deve substituir o erro seguro da API.
        }
    }
    async readXml(response) {
        const contentType = response.headers
            .get("content-type")
            ?.split(";")[0]
            ?.trim()
            .toLowerCase();
        if (contentType &&
            !["application/xml", "text/xml", "application/octet-stream"].includes(contentType)) {
            await this.discardResponse(response);
            throw new AppError_1.AppError("O Mercado Livre retornou um documento que não é XML", 502);
        }
        const contentLength = Number(response.headers.get("content-length"));
        if (contentLength > NFeParserService_1.MAX_NFE_XML_BYTES) {
            await this.discardResponse(response);
            throw new AppError_1.AppError("XML da NF-e excede o limite de tamanho", 502);
        }
        if (!response.body) {
            throw new AppError_1.AppError("O Mercado Livre retornou um XML vazio", 502);
        }
        const reader = response.body.getReader();
        const chunks = [];
        let bytes = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                bytes += value.byteLength;
                if (bytes > NFeParserService_1.MAX_NFE_XML_BYTES) {
                    await reader.cancel();
                    throw new AppError_1.AppError("XML da NF-e excede o limite de tamanho", 502);
                }
                chunks.push(value);
            }
        }
        catch (error) {
            if (error instanceof AppError_1.AppError)
                throw error;
            throw new AppError_1.AppError("Não foi possível obter o XML da NF-e no Mercado Livre", 503);
        }
        finally {
            reader.releaseLock();
        }
        const xml = node_buffer_1.Buffer.concat(chunks, bytes).toString("utf8");
        if (!xml.trim())
            throw new AppError_1.AppError("O Mercado Livre retornou um XML vazio", 502);
        return xml;
    }
    async waitBeforeRetry(attempt, retryAfter = null) {
        const seconds = retryAfter === null ? NaN : Number(retryAfter);
        const retryAfterMs = Number.isFinite(seconds)
            ? Math.max(0, seconds * 1000)
            : Math.max(0, Date.parse(retryAfter ?? "") - Date.now()) || 0;
        await this.sleepFn(Math.min(Math.max(500 * 2 ** (attempt - 1), retryAfterMs), MAX_RETRY_DELAY_MS));
    }
}
exports.MercadoLivreInvoiceService = MercadoLivreInvoiceService;
//# sourceMappingURL=mercadoLivreInvoiceService.js.map