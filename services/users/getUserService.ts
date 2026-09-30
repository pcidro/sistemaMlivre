import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { ensureAuthenticatedUser, publicUserSelect } from "./userUtils";

export class GetUserService {
  async execute(requesterId: string, id: string) {
    await ensureAuthenticatedUser(requesterId);

    const user = await prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });

    if (!user) {
      throw new AppError("Usuário não encontrado", 404);
    }

    return user;
  }
}
