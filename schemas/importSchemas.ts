import { z } from "zod";

const dateString = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

export const mercadoLivreImportBodySchema = z.object({
  marketplaceAccountId: z.uuid(),
  dateFrom: dateString.transform((value) => new Date(value)),
  dateTo: dateString.transform((value) => new Date(
    value.length === 10 ? `${value}T23:59:59.999Z` : value,
  )),
}).strict().refine((input) => input.dateFrom <= input.dateTo, {
  message: "dateFrom deve ser anterior ou igual a dateTo", path: ["dateTo"],
});
