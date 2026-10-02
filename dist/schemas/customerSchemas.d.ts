import { z } from "zod";
export declare const customerListQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>;
    limit: z.ZodDefault<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>;
    search: z.ZodOptional<z.ZodString>;
    platform: z.ZodOptional<z.ZodEnum<{
        MAGALU: "MAGALU";
        MERCADO_LIVRE: "MERCADO_LIVRE";
    }>>;
    marketplaceAccountId: z.ZodOptional<z.ZodUUID>;
    hasPhone: z.ZodOptional<z.ZodPipe<z.ZodEnum<{
        false: "false";
        true: "true";
    }>, z.ZodTransform<boolean, "false" | "true">>>;
    dateFrom: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodISODateTime, z.ZodISODate]>, z.ZodTransform<Date, string>>>;
    dateTo: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodISODateTime, z.ZodISODate]>, z.ZodTransform<Date, string>>>;
}, z.core.$strict>;
export declare const customerIdSchema: z.ZodUUID;
export type CustomerListFilters = z.output<typeof customerListQuerySchema>;
//# sourceMappingURL=customerSchemas.d.ts.map