import { compare } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

interface AuthUserServiceProps {
  email: string;
  password: string;
}

export class AuthUserService {
  async execute({ email, password }: AuthUserServiceProps) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new AppError("Email ou senha incorretos", 401);
    }

    const passwordMatch = await compare(password, user.passwordHash);

    if (!passwordMatch) {
      throw new AppError("Email ou senha incorretos", 401);
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new AppError("Configuração de autenticação ausente", 500);
    }

    const token = sign(
      {
        name: user.name,
        email: user.email,
      },
      jwtSecret,
      {
        subject: user.id,
        expiresIn: "30d",
      },
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }
}
