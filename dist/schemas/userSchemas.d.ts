import { z } from "zod";
export declare const createUserSchema: z.ZodObject<{
    name: z.ZodString;
    username: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    password: z.ZodString;
    avatarUrl: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">, z.ZodNull]>, z.ZodTransform<string | null, string | null>>>;
}, z.core.$strip>;
export declare const updateUserSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    username: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    email: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    password: z.ZodOptional<z.ZodString>;
    avatarUrl: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">, z.ZodNull]>, z.ZodTransform<string | null, string | null>>>;
}, z.core.$strip>;
export declare const userIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const listUsersQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    search: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersQuerySchema>;
//# sourceMappingURL=userSchemas.d.ts.map