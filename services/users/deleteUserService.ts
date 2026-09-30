import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { ensureCanManageUser } from "./userUtils";

export class DeleteUserService {
  async execute(requesterId: string, id: string) {
    await ensureCanManageUser(requesterId, id);

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new AppError("Usuário não encontrado", 404);
    }

    await prisma.user.delete({ where: { id } });
  }
}
