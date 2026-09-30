"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateUserService = void 0;
const bcryptjs_1 = require("bcryptjs");
const prisma_1 = require("../../lib/prisma");
const userUtils_1 = require("./userUtils");
class CreateUserService {
    async execute(input) {
        const conflict = await (0, userUtils_1.findConflictingUser)(input.email, input.username);
        (0, userUtils_1.throwConflict)(conflict, input.email);
        const passwordHash = await (0, bcryptjs_1.hash)(input.password, 12);
        return prisma_1.prisma.user.create({
            data: {
                name: input.name,
                username: input.username,
                email: input.email,
                passwordHash,
                ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
            },
            select: userUtils_1.publicUserSelect,
        });
    }
}
exports.CreateUserService = CreateUserService;
//# sourceMappingURL=createUserService.js.map