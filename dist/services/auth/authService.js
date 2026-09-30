"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthUserService = void 0;
const bcryptjs_1 = require("bcryptjs");
const jsonwebtoken_1 = require("jsonwebtoken");
const prisma_1 = require("../../lib/prisma");
const AppError_1 = require("../../errors/AppError");
class AuthUserService {
    async execute({ email, password }) {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await prisma_1.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            throw new AppError_1.AppError("Email ou senha incorretos", 401);
        }
        const passwordMatch = await (0, bcryptjs_1.compare)(password, user.passwordHash);
        if (!passwordMatch) {
            throw new AppError_1.AppError("Email ou senha incorretos", 401);
        }
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new AppError_1.AppError("Configuração de autenticação ausente", 500);
        }
        const token = (0, jsonwebtoken_1.sign)({
            name: user.name,
            email: user.email,
        }, jwtSecret, {
            subject: user.id,
            expiresIn: "30d",
        });
        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                avatarUrl: user.avatarUrl,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        };
    }
}
exports.AuthUserService = AuthUserService;
//# sourceMappingURL=authService.js.map