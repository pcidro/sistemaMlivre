import { z } from "zod";
export declare const loginSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    password: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=authSchemas.d.ts.map