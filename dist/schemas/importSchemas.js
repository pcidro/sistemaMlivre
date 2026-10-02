"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mercadoLivreImportBodySchema = void 0;
const zod_1 = require("zod");
const dateString = zod_1.z.union([zod_1.z.iso.datetime({ offset: true }), zod_1.z.iso.date()]);
exports.mercadoLivreImportBodySchema = zod_1.z.object({
    marketplaceAccountId: zod_1.z.uuid(),
    dateFrom: dateString.transform((value) => new Date(value)),
    dateTo: dateString.transform((value) => new Date(value.length === 10 ? `${value}T23:59:59.999Z` : value)),
}).strict().refine((input) => input.dateFrom <= input.dateTo, {
    message: "dateFrom deve ser anterior ou igual a dateTo", path: ["dateTo"],
});
//# sourceMappingURL=importSchemas.js.map