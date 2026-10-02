import { z } from "zod";
export declare const mercadoLivreImportBodySchema: z.ZodObject<{
    marketplaceAccountId: z.ZodUUID;
    dateFrom: z.ZodPipe<z.ZodUnion<readonly [z.ZodISODateTime, z.ZodISODate]>, z.ZodTransform<Date, string>>;
    dateTo: z.ZodPipe<z.ZodUnion<readonly [z.ZodISODateTime, z.ZodISODate]>, z.ZodTransform<Date, string>>;
}, z.core.$strict>;
//# sourceMappingURL=importSchemas.d.ts.map