import type { Request, Response } from "express";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { publicUserSelect } from "../../services/users/userUtils";

const findCurrentUser = async (id: string) => prisma.user.findUnique({ where: { id }, select: publicUserSelect });

/** Usa a autenticação existente; não cria nem renova tokens. */
export class SessionController {
  constructor(private readonly findUser = findCurrentUser) {}

  async me(req: Request, res: Response) {
    const user = await this.findUser(req.user_id);
    if (!user) throw new AppError("Sessão inválida. Entre novamente", 401);
    res.set("Cache-Control", "private, no-store");
    return res.json(user);
  }

  logout(_req: Request, res: Response) {
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie("auth_token", {
      httpOnly: true, secure: isProduction,
      sameSite: isProduction ? "none" : "lax", path: "/",
    });
    res.set("Cache-Control", "private, no-store");
    return res.status(204).send();
  }
}
