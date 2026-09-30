"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicUserSelect = void 0;
exports.ensureAuthenticatedUser = ensureAuthenticatedUser;
exports.ensureCanManageUser = ensureCanManageUser;
exports.findConflictingUser = findConflictingUser;
exports.throwConflict = throwConflict;
const AppError_1 = require("../../errors/AppError");
const prisma_1 = require("../../lib/prisma");
exports.publicUserSelect = {
    id: true,
    name: true,
    username: true,
    email: true,
    avatarUrl: true,
    role: true,
    createdAt: true,
    updatedAt: true,
};
async function ensureAuthenticatedUser(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
    });
    if (!user) {
        throw new AppError_1.AppError("Usuário autenticado não encontrado", 401);
    }
    return user;
}
async function ensureCanManageUser(requesterId, targetId) {
    const requester = await ensureAuthenticatedUser(requesterId);
    if (requester.id !== targetId && requester.role !== "ADMIN") {
        throw new AppError_1.AppError("Você não tem permissão para esta operação", 403);
    }
}
async function findConflictingUser(email, username, excludeId) {
    const uniqueFields = [
        ...(email ? [{ email }] : []),
        ...(username ? [{ username }] : []),
    ];
    if (uniqueFields.length === 0)
        return null;
    return prisma_1.prisma.user.findFirst({
        where: {
            ...(excludeId ? { id: { not: excludeId } } : {}),
            OR: uniqueFields,
        },
        select: { email: true, username: true },
    });
}
function throwConflict(conflict, email) {
    if (!conflict)
        return;
    if (email && conflict.email === email) {
        throw new AppError_1.AppError("Email já cadastrado", 409);
    }
    throw new AppError_1.AppError("Nome de usuário já cadastrado", 409);
}
//# sourceMappingURL=userUtils.js.map