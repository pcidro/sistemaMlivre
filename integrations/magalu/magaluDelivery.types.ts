import { z } from "zod";
import { magaluOrderResponseSchema } from "./magaluOrder.types";

const identifier = z.string().trim().min(1);
const channelSchema = z.object({ id: z.uuid().transform(id => id.toLowerCase()) });

// Projeções oficiais: não carregar dados de destinatário, endereço ou valores
// para fora da integração quando basta identificar pedido, canal e pacote.
export const magaluOrderChannelSchema = z.object({
  code: identifier,
  channel: channelSchema,
});

export const magaluDeliveryDetailsSchema = z.object({
  id: identifier,
  code: identifier.nullish(),
  status: identifier.nullish(),
  order: z.object({
    code: identifier,
    channel: channelSchema,
  }),
});

export const magaluDeliveryResponseSchema = magaluOrderResponseSchema.pick({ meta: true }).extend({
  results: z.array(magaluDeliveryDetailsSchema).max(100),
});

export type MagaluDeliveryDetails = z.infer<typeof magaluDeliveryDetailsSchema>;
export type MagaluDeliveryResponse = z.infer<typeof magaluDeliveryResponseSchema>;
