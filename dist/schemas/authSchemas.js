"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    email: zod_1.z
        .string({ error: "Email é obrigatório" })
        .trim()
        .email("Email inválido")
        .transform((email) => email.toLowerCase()),
    password: zod_1.z.string({ error: "Senha é obrigatória" }).min(1, "Senha é obrigatória"),
});
//# sourceMappingURL=authSchemas.js.map