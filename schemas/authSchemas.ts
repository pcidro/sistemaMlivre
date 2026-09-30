import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ error: "Email é obrigatório" })
    .trim()
    .email("Email inválido")
    .transform((email) => email.toLowerCase()),
  password: z.string({ error: "Senha é obrigatória" }).min(1, "Senha é obrigatória"),
});
