import { z } from "zod";

const nameSchema = z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(100);
const usernameSchema = z
  .string()
  .trim()
  .min(3, "Usuário deve ter ao menos 3 caracteres")
  .max(50)
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Usuário deve conter apenas letras, números, ponto, hífen ou sublinhado",
  )
  .transform((username) => username.toLowerCase());
const emailSchema = z
  .string()
  .trim()
  .email("Email inválido")
  .transform((email) => email.toLowerCase());
const passwordSchema = z
  .string()
  .min(8, "Senha deve ter ao menos 8 caracteres")
  .max(72, "Senha deve ter no máximo 72 caracteres");
const avatarUrlSchema = z
  .union([z.string().trim().url("URL do avatar inválida").max(2048), z.literal(""), z.null()])
  .transform((value) => (value === "" ? null : value));

export const createUserSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  avatarUrl: avatarUrlSchema.optional(),
});

export const updateUserSchema = z
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

export const userIdParamSchema = z.object({
  id: z.string().uuid("Id de usuário inválido"),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersQuerySchema>;
