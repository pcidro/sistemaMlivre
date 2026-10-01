"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoLivreRecipientService = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const normalizePhone_1 = require("../../utils/normalizePhone");
const mercadoLivreTokenService_1 = require("./mercadoLivreTokenService");
const API_BASE_URL = "https://api.mercadolibre.com";
const externalIdSchema = zod_1.z.union([
    zod_1.z.string().min(1),
    zod_1.z.number().int().positive(),
]);
const phonePartSchema = zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).nullable().optional();
const phoneSchema = zod_1.z
    .union([
    zod_1.z.string(),
    zod_1.z.object({
        area_code: phonePartSchema,
        number: phonePartSchema,
    }),
])
    .nullable()
    .optional();
const orderDetailsSchema = zod_1.z.object({
    buyer: zod_1.z
        .object({
        first_name: zod_1.z.string().nullable().optional(),
        last_name: zod_1.z.string().nullable().optional(),
        phone: phoneSchema,
        alternative_phone: phoneSchema,
    })
        .nullable()
        .optional(),
    shipping: zod_1.z
        .object({
        id: externalIdSchema.nullable().optional(),
    })
        .nullable()
        .optional(),
});
const shipmentReferenceSchema = zod_1.z.object({
    id: externalIdSchema,
    type: zod_1.z.string().nullable().optional(),
});
const recipientFieldsSchema = zod_1.z.object({
    receiver_name: zod_1.z.string().nullable().optional(),
    receiver_phone: zod_1.z.string().nullable().optional(),
});
const shipmentSchema = zod_1.z.object({
    receiver_name: zod_1.z.string().nullable().optional(),
    receiver_phone: zod_1.z.string().nullable().optional(),
    receiver_address: recipientFieldsSchema.nullable().optional(),
    destination: recipientFieldsSchema.nullable().optional(),
});
function normalizeName(value) {
    const normalized = value?.trim().replace(/\s+/g, " ");
    return normalized || null;
}
function externalIdToString(value) {
    if (typeof value === "number" && !Number.isSafeInteger(value)) {
        throw new AppError_1.AppError("O Mercado Livre retornou um identificador inválido", 502);
    }
    return String(value);
}
function phoneValue(value) {
    if (typeof value === "string") {
        return (0, normalizePhone_1.normalizePhone)(value);
    }
    if (!value)
        return null;
    const areaCode = value.area_code ?? "";
    const number = value.number ?? "";
    return (0, normalizePhone_1.normalizePhone)(`${areaCode}${number}`);
}
function buyerData(buyer) {
    if (!buyer)
        return { name: null, phone: null };
    return {
        name: normalizeName([buyer.first_name, buyer.last_name].filter(Boolean).join(" ")),
        phone: phoneValue(buyer.phone) ?? phoneValue(buyer.alternative_phone),
    };
}
function shipmentRecipientData(shipment) {
    const source = shipment.destination ?? shipment.receiver_address;
    return {
        name: normalizeName(source?.receiver_name ?? shipment.receiver_name),
        phone: (0, normalizePhone_1.normalizePhone)(source?.receiver_phone ?? shipment.receiver_phone ?? null),
    };
}
class MercadoLivreRecipientService {
    tokenService;
    fetchFn;
    constructor(dependencies = {}) {
        this.tokenService =
            dependencies.tokenService ?? new mercadoLivreTokenService_1.MercadoLivreTokenService();
        this.fetchFn = dependencies.fetchFn ?? globalThis.fetch;
    }
    async getRecipient(marketplaceAccountId, order) {
        const context = {
            marketplaceAccountId,
            accessToken: await this.tokenService.getValidAccessToken(marketplaceAccountId),
        };
        const detailsPayload = await this.requestJson(`${API_BASE_URL}/orders/${encodeURIComponent(order.externalOrderId)}`, context);
        const detailsResult = orderDetailsSchema.safeParse(detailsPayload);
        if (!detailsResult.success) {
            throw new AppError_1.AppError("O Mercado Livre retornou dados inválidos para o pedido", 502);
        }
        const orderBuyer = buyerData(detailsResult.data.buyer);
        const fallback = {
            name: orderBuyer.name ?? normalizeName(order.customer.name),
            phone: orderBuyer.phone ?? (0, normalizePhone_1.normalizePhone)(order.customer.phone),
        };
        const shipmentId = detailsResult.data.shipping?.id === null ||
            detailsResult.data.shipping?.id === undefined
            ? await this.findForwardShipmentId(order.externalOrderId, context)
            : externalIdToString(detailsResult.data.shipping.id);
        if (!shipmentId)
            return fallback;
        const shipmentUrl = new URL(`${API_BASE_URL}/shipments/${shipmentId}`);
        shipmentUrl.searchParams.set("views", "destination");
        const shipmentPayload = await this.requestJson(shipmentUrl, context, {
            "X-Api-Version": "2",
            "x-format-new": "true",
        });
        if (shipmentPayload === null)
            return fallback;
        const shipmentResult = shipmentSchema.safeParse(shipmentPayload);
        if (!shipmentResult.success) {
            throw new AppError_1.AppError("O Mercado Livre retornou dados inválidos para o envio", 502);
        }
        const recipient = shipmentRecipientData(shipmentResult.data);
        return {
            name: recipient.name ?? fallback.name,
            phone: recipient.phone ?? fallback.phone,
        };
    }
    async findForwardShipmentId(orderId, context) {
        const url = new URL(`${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/shipments`);
        url.searchParams.set("hosted", "true");
        const payload = await this.requestJson(url, context, {
            "X-New-Domain": "true",
        });
        if (payload === null)
            return null;
        const listResult = zod_1.z.array(shipmentReferenceSchema).safeParse(payload);
        if (listResult.success) {
            const forwardShipment = listResult.data.find((shipment) => shipment.type === "forward");
            return forwardShipment
                ? externalIdToString(forwardShipment.id)
                : null;
        }
        const singleResult = shipmentReferenceSchema.safeParse(payload);
        if (singleResult.success &&
            (!singleResult.data.type || singleResult.data.type === "forward")) {
            return externalIdToString(singleResult.data.id);
        }
        throw new AppError_1.AppError("O Mercado Livre retornou uma lista de envios inválida", 502);
    }
    async requestJson(input, context, extraHeaders = {}) {
        let refreshedAfterUnauthorized = false;
        while (true) {
            let response;
            try {
                response = await this.fetchFn(input, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${context.accessToken}`,
                        ...extraHeaders,
                    },
                });
            }
            catch {
                throw new AppError_1.AppError("A API do Mercado Livre está indisponível", 503);
            }
            if (response.status === 401 && !refreshedAfterUnauthorized) {
                context.accessToken = await this.tokenService.refreshAccessToken(context.marketplaceAccountId);
                refreshedAfterUnauthorized = true;
                continue;
            }
            if (response.status === 204 || response.status === 404) {
                return null;
            }
            if (response.status === 429) {
                throw new AppError_1.AppError("Limite de requisições do Mercado Livre excedido. Tente novamente mais tarde", 429);
            }
            if (response.status >= 500) {
                throw new AppError_1.AppError("A API do Mercado Livre está indisponível", 503);
            }
            if (!response.ok) {
                throw new AppError_1.AppError("Não foi possível consultar os dados do destinatário no Mercado Livre", 502);
            }
            try {
                return await response.json();
            }
            catch {
                throw new AppError_1.AppError("O Mercado Livre retornou uma resposta inválida", 502);
            }
        }
    }
}
exports.MercadoLivreRecipientService = MercadoLivreRecipientService;
//# sourceMappingURL=mercadoLivreRecipientService.js.map