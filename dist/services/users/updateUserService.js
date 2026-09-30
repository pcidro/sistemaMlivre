"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateUserService = void 0;
const bcryptjs_1 = require("bcryptjs");
const AppError_1 = require("../../errors/AppError");
const prisma_1 = require("../../lib/prisma");
const userUtils_1 = require("./userUtils");
class UpdateUserService {
    async execute(requesterId, id, input) {
        await (0, userUtils_1.ensureCanManageUser)(requesterId, id);
        const currentUser = await prisma_1.prisma.user.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!currentUser) {
            throw new AppError_1.AppError("Usuário não encontrado", 404);
        }
        const conflict = await (0, userUtils_1.findConflictingUser)(input.email, input.username, id);
        (0, userUtils_1.throwConflict)(conflict, input.email);
        const passwordHash = input.password ? await (0, bcryptjs_1.hash)(input.password, 12) : undefined;
        const data = {};
        if (input.name !== undefined)
            data.name = input.name;
        if (input.username !== undefined)
            data.username = input.username;
        if (input.email !== undefined)
            data.email = input.email;
        if (passwordHash !== undefined)
            data.passwordHash = passwordHash;
        if (input.avatarUrl !== undefined)
            data.avatarUrl = input.avatarUrl;
        return prisma_1.prisma.user.update({
            where: { id },
            data,
            select: userUtils_1.publicUserSelect,
        });
    }
}
exports.UpdateUserService = UpdateUserService;
//# sourceMappingURL=updateUserService.js.map