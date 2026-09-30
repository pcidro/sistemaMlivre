"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteUserService = void 0;
const AppError_1 = require("../../errors/AppError");
const prisma_1 = require("../../lib/prisma");
const userUtils_1 = require("./userUtils");
class DeleteUserService {
    async execute(requesterId, id) {
        await (0, userUtils_1.ensureCanManageUser)(requesterId, id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!user) {
            throw new AppError_1.AppError("Usuário não encontrado", 404);
        }
        await prisma_1.prisma.user.delete({ where: { id } });
    }
}
exports.DeleteUserService = DeleteUserService;
//# sourceMappingURL=deleteUserService.js.map