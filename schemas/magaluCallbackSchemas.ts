import { z } from "zod";

const callbackValue = z.string().min(1).max(2048).regex(/^[^\s\x00-\x1f\x7f]+$/);

export const magaluCallbackQuerySchema = z.union([
  z.object({ code: callbackValue, state: callbackValue }).strict(),
  z.object({
    error: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_]+$/),
    state: callbackValue,
    error_description: z.string().max(1024).optional(),
    error_uri: z.string().max(2048).optional(),
  }).strict(),
]);
