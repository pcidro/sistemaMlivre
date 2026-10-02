"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerIdSchema = exports.customerListQuerySchema = void 0;
const zod_1 = require("zod");
const pageSchema = zod_1.z.string().regex(/^[1-9]\d*$/)
    .transform(Number).pipe(zod_1.z.number().int().max(2_147_483_647)).default(1);
const limitSchema = zod_1.z.string().regex(/^[1-9]\d*$/)
    .transform(Number).pipe(zod_1.z.number().int().max(100)).default(50);
const dateSchema = zod_1.z.union([zod_1.z.iso.datetime({ offset: true }), zod_1.z.iso.date()]);
exports.customerListQuerySchema = zod_1.z.object({
    page: pageSchema,
    limit: limitSchema,
    search: zod_1.z.string().trim().max(200).optional(),
    platform: zod_1.z.enum(["MERCADO_LIVRE", "MAGALU"]).optional(),
    marketplaceAccountId: zod_1.z.uuid().optional(),
    hasPhone: zod_1.z.enum(["true", "false"]).transform((value) => value === "true").optional(),
    dateFrom: dateSchema.transform((value) => new Date(value)).optional(),
    dateTo: dateSchema.transform((value) => new Date(value.length === 10 ? `${value}T23:59:59.999Z` : value)).optional(),
}).strict()
    .refine((query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo, {
    message: "dateFrom deve ser anterior ou igual a dateTo", path: ["dateTo"],
})
    .refine((query) => (query.page - 1) * query.limit <= 2_147_483_647, {
    message: "Página solicitada excede o limite de paginação", path: ["page"],
});
exports.customerIdSchema = zod_1.z.uuid();
//# sourceMappingURL=customerSchemas.js.map