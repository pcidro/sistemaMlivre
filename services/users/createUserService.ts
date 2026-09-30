import { hash } from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { CreateUserInput } from "../../schemas/userSchemas";
import { findConflictingUser, publicUserSelect, throwConflict } from "./userUtils";

export class CreateUserService {
  async execute(input: CreateUserInput) {
    const conflict = await findConflictingUser(input.email, input.username);
    throwConflict(conflict, input.email);

    const passwordHash = await hash(input.password, 12);

    return prisma.user.create({
      data: {
        name: input.name,
        username: input.username,
        email: input.email,
        passwordHash,
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
      select: publicUserSelect,
    });
  }
}
