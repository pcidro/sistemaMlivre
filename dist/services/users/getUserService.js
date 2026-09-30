"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetUserService = void 0;
const AppError_1 = require("../../errors/AppError");
const prisma_1 = require("../../lib/prisma");
const userUtils_1 = require("./userUtils");
class GetUserService {
    async execute(requesterId, id) {
        await (0, userUtils_1.ensureAuthenticatedUser)(requesterId);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id },
            select: userUtils_1.publicUserSelect,
        });
        if (!user) {
            throw new AppError_1.AppError("Usuário não encontrado", 404);
        }
        return user;
    }
}
exports.GetUserService = GetUserService;
//# sourceMappingURL=getUserService.js.map