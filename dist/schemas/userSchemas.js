"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsersQuerySchema = exports.userIdParamSchema = exports.updateUserSchema = exports.createUserSchema = void 0;
const zod_1 = require("zod");
const nameSchema = zod_1.z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(100);
const usernameSchema = zod_1.z
    .string()
    .trim()
    .min(3, "Usuário deve ter ao menos 3 caracteres")
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, "Usuário deve conter apenas letras, números, ponto, hífen ou sublinhado")
    .transform((username) => username.toLowerCase());
const emailSchema = zod_1.z
    .string()
    .trim()
    .email("Email inválido")
    .transform((email) => email.toLowerCase());
const passwordSchema = zod_1.z
    .string()
    .min(8, "Senha deve ter ao menos 8 caracteres")
    .max(72, "Senha deve ter no máximo 72 caracteres");
const avatarUrlSchema = zod_1.z
    .union([zod_1.z.string().trim().url("URL do avatar inválida").max(2048), zod_1.z.literal(""), zod_1.z.null()])
    .transform((value) => (value === "" ? null : value));
exports.createUserSchema = zod_1.z.object({
    name: nameSchema,
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    avatarUrl: avatarUrlSchema.optional(),
});
exports.updateUserSchema = zod_1.z
    .object({
    name: nameSchema.optional(),
    username: usernameSchema.optional(),
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    avatarUrl: avatarUrlSchema.optional(),
})
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Informe ao menos um campo para atualizar",
});
exports.userIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid("Id de usuário inválido"),
});
exports.listUsersQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    search: zod_1.z.string().trim().max(100).optional(),
});
//# sourceMappingURL=userSchemas.js.map