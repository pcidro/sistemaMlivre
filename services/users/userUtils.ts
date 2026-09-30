import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";

export const publicUserSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function ensureAuthenticatedUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw new AppError("Usuário autenticado não encontrado", 401);
  }

  return user;
}

export async function ensureCanManageUser(requesterId: string, targetId: string) {
  const requester = await ensureAuthenticatedUser(requesterId);

  if (requester.id !== targetId && requester.role !== "ADMIN") {
    throw new AppError("Você não tem permissão para esta operação", 403);
  }
}

export async function findConflictingUser(
  email: string | undefined,
  username: string | undefined,
  excludeId?: string,
) {
  const uniqueFields = [
    ...(email ? [{ email }] : []),
    ...(username ? [{ username }] : []),
  ];

  if (uniqueFields.length === 0) return null;

  return prisma.user.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: uniqueFields,
    },
    select: { email: true, username: true },
  });
}

export function throwConflict(
  conflict: { email: string; username: string } | null,
  email?: string,
) {
  if (!conflict) return;

  if (email && conflict.email === email) {
    throw new AppError("Email já cadastrado", 409);
  }

  throw new AppError("Nome de usuário já cadastrado", 409);
}
