import { z } from "zod";

// Projeção dos campos consumidos de GET /seller/v1/orders. Campos adicionais
// do provedor são descartados na validação, sem vazar para o domínio interno.
const optionalString = z.string().nullish();

export const magaluPhoneSchema = z.object({
  country_code: optionalString,
  area_code: optionalString,
  number: optionalString,
  // A documentação dá exemplos, não um enum fechado: outros tipos são fallback.
  type: optionalString,
});

export const magaluCustomerSchema = z.object({
  name: optionalString,
  document_number: optionalString,
  customer_type: optionalString,
  phones: z.array(magaluPhoneSchema).nullish(),
  email: optionalString,
});

export const magaluOrderItemSchema = z.object({
  info: z.object({
    id: optionalString,
    sku: optionalString,
    name: optionalString,
    description: optionalString,
  }).nullish(),
  quantity: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  unit_price: z.object({
    currency: optionalString,
    normalizer: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullish(),
    value: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullish(),
  }).nullish(),
});

export const magaluDeliverySchema = z.object({
  id: optionalString,
  code: optionalString,
  status: optionalString,
  purchased_at: optionalString,
  items: z.array(magaluOrderItemSchema).nullish(),
});

export const magaluOrderSchema = z.object({
  id: optionalString,
  code: optionalString,
  status: optionalString,
  created_at: optionalString,
  purchased_at: optionalString,
  updated_at: optionalString,
  customer: magaluCustomerSchema.nullish(),
  deliveries: z.array(magaluDeliverySchema).nullish(),
});

export const magaluOrderResponseSchema = z.object({
  meta: z.object({
    links: z.object({
      next: optionalString,
      previous: optionalString,
      self: z.string(),
    }),
    page: z.object({
      count: z.number().int().nonnegative(),
      limit: z.number().int().nonnegative(),
      max_limit: z.number().int().nonnegative(),
      offset: z.number().int().nonnegative(),
    }),
  }),
  results: z.array(magaluOrderSchema),
});

export type MagaluOrderResponse = z.infer<typeof magaluOrderResponseSchema>;
export type MagaluOrder = z.infer<typeof magaluOrderSchema>;
export type MagaluCustomer = z.infer<typeof magaluCustomerSchema>;
export type MagaluPhone = z.infer<typeof magaluPhoneSchema>;
export type MagaluDelivery = z.infer<typeof magaluDeliverySchema>;
export type MagaluOrderItem = z.infer<typeof magaluOrderItemSchema>;
