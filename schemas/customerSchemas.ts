import { z } from "zod";

const pageSchema = z.string().regex(/^[1-9]\d*$/)
  .transform(Number).pipe(z.number().int().max(2_147_483_647)).default(1);
const limitSchema = z.string().regex(/^[1-9]\d*$/)
  .transform(Number).pipe(z.number().int().max(100)).default(50);
const dateSchema = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

export const customerListQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  search: z.string().trim().max(200).optional(),
  platform: z.enum(["MERCADO_LIVRE", "MAGALU"]).optional(),
  marketplaceAccountId: z.uuid().optional(),
  hasPhone: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  dateFrom: dateSchema.transform((value) => new Date(value)).optional(),
  dateTo: dateSchema.transform((value) => new Date(
    value.length === 10 ? `${value}T23:59:59.999Z` : value,
  )).optional(),
}).strict()
  .refine((query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo, {
    message: "dateFrom deve ser anterior ou igual a dateTo", path: ["dateTo"],
  })
  .refine((query) => (query.page - 1) * query.limit <= 2_147_483_647, {
    message: "Página solicitada excede o limite de paginação", path: ["page"],
  });

export const customerIdSchema = z.uuid();
export type CustomerListFilters = z.output<typeof customerListQuerySchema>;
