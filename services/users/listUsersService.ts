import { prisma } from "../../lib/prisma";
import { ListUsersInput } from "../../schemas/userSchemas";
import { ensureAuthenticatedUser, publicUserSelect } from "./userUtils";

export class ListUsersService {
  async execute(requesterId: string, { page, limit, search }: ListUsersInput) {
    await ensureAuthenticatedUser(requesterId);

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { username: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: publicUserSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
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
