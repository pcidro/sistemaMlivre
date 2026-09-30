import { hash } from "bcryptjs";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { UpdateUserInput } from "../../schemas/userSchemas";
import {
  ensureCanManageUser,
  findConflictingUser,
  publicUserSelect,
  throwConflict,
} from "./userUtils";

export class UpdateUserService {
  async execute(requesterId: string, id: string, input: UpdateUserInput) {
    await ensureCanManageUser(requesterId, id);

    const currentUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!currentUser) {
      throw new AppError("Usuário não encontrado", 404);
    }

    const conflict = await findConflictingUser(input.email, input.username, id);
    throwConflict(conflict, input.email);

    const passwordHash = input.password ? await hash(input.password, 12) : undefined;
    const data: {
      name?: string;
      username?: string;
      email?: string;
      passwordHash?: string;
      avatarUrl?: string | null;
    } = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.username !== undefined) data.username = input.username;
    if (input.email !== undefined) data.email = input.email;
    if (passwordHash !== undefined) data.passwordHash = passwordHash;
    if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;

    return prisma.user.update({
      where: { id },
      data,
      select: publicUserSelect,
    });
  }
}
