import { z } from "zod";
export declare const magaluCallbackQuerySchema: z.ZodUnion<readonly [z.ZodObject<{
    code: z.ZodString;
    state: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    error: z.ZodString;
    state: z.ZodString;
    error_description: z.ZodOptional<z.ZodString>;
    error_uri: z.ZodOptional<z.ZodString>;
}, z.core.$strict>]>;
//# sourceMappingURL=magaluCallbackSchemas.d.ts.map