"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListUsersService = void 0;
const prisma_1 = require("../../lib/prisma");
const userUtils_1 = require("./userUtils");
class ListUsersService {
    async execute(requesterId, { page, limit, search }) {
        await (0, userUtils_1.ensureAuthenticatedUser)(requesterId);
        const where = search
            ? {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { username: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                ],
            }
            : {};
        const [users, total] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.user.findMany({
                where,
                select: userUtils_1.publicUserSelect,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma_1.prisma.user.count({ where }),
        ]);
        return {
            data: users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
exports.ListUsersService = ListUsersService;
//# sourceMappingURL=listUsersService.js.map