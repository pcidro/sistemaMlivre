import { z } from "zod";

import type { ParsedNFeData } from "../../services/invoices/NFeParserService";
import { magaluOrderResponseSchema } from "./magaluOrder.types";

/** Payload externo permanece dentro da integração. XML é conteúdo, não uma URL. */
export const magaluInvoiceSchema = z.object({
  issued_at: z.string().nullish(),
  key: z.string().nullish(),
  status: z.string().nullish(),
  xml: z.string().nullish(),
});

export const magaluInvoiceResponseSchema = magaluOrderResponseSchema.pick({ meta: true }).extend({
  results: z.array(magaluInvoiceSchema),
});

export type MagaluInvoice = z.infer<typeof magaluInvoiceSchema>;

/** Dados transitórios normalizados; nunca inclui o XML ou credenciais. */
export interface MagaluProcessedInvoice extends ParsedNFeData {
  // A API também documenta datas sem fuso. Preservar a representação, sem inventar UTC.
  issuedAt: string | null;
  status: "approved";
}
