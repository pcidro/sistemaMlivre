import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import type { Prisma, MarketplacePlatform } from "../../generated/prisma/client";

export interface PendingMagaluAuthorization {
  stateHash: string;
  userId: string;
  configFingerprint: string;
  expiresAt: Date;
}

export interface MagaluAccountAuthorization {
  userId: string;
  externalAccountId: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: Date;
}

export interface MagaluOAuthStorage {
  createState(state: PendingMagaluAuthorization): Promise<void>;
  consumeState(stateHash: string, configFingerprint: string, now: Date): Promise<{ userId: string } | null>;
  userExists(userId: string): Promise<boolean>;
  saveAccount(authorization: MagaluAccountAuthorization): Promise<void>;
}

export interface MagaluOAuthDatabase {
  user: { findUnique(args: { where: { id: string }; select: { id: true } }): Promise<{ id: string } | null> };
  marketplaceOAuthState: {
    create(args: Prisma.MarketplaceOAuthStateCreateArgs): Promise<unknown>;
    findUnique(args: { where: { stateHash: string } }): Promise<(PendingMagaluAuthorization & { platform: MarketplacePlatform }) | null>;
    deleteMany(args: Prisma.MarketplaceOAuthStateDeleteManyArgs): Promise<{ count: number }>;
  };
  marketplaceAccount: {
    findUnique(args: { where: { platform_externalAccountId: { platform: "MAGALU"; externalAccountId: string } }; select: { id: true; userId: true } }): Promise<{ id: string; userId: string | null } | null>;
    create(args: Prisma.MarketplaceAccountCreateArgs): Promise<unknown>;
    updateMany(args: Prisma.MarketplaceAccountUpdateManyArgs): Promise<{ count: number }>;
  };
}

export function createMagaluOAuthStorage(database: MagaluOAuthDatabase = prisma): MagaluOAuthStorage {
  return {
    async createState(state) {
      await database.marketplaceOAuthState.deleteMany({
        where: { platform: "MAGALU", expiresAt: { lte: new Date() } },
      });
      await database.marketplaceOAuthState.create({ data: { ...state, platform: "MAGALU" } });
    },
    async consumeState(stateHash, configFingerprint, now) {
      const state = await database.marketplaceOAuthState.findUnique({ where: { stateHash } });
      if (!state || state.platform !== "MAGALU" || state.configFingerprint !== configFingerprint || state.expiresAt <= now) {
        return null;
      }
      // DELETE condicional é atômico: apenas um callback vence, inclusive entre
      // processos/instâncias diferentes. Remover antes de qualquer chamada externa.
      const consumed = await database.marketplaceOAuthState.deleteMany({
        where: { stateHash, platform: "MAGALU", configFingerprint, expiresAt: { gt: now } },
      });
      return consumed.count === 1 ? { userId: state.userId } : null;
    },
    async userExists(id) {
      return Boolean(await database.user.findUnique({ where: { id }, select: { id: true } }));
    },
    async saveAccount(authorization) {
      const { userId, externalAccountId, ...tokens } = authorization;
      const where = { platform_externalAccountId: { platform: "MAGALU" as const, externalAccountId } };
      // Uma criação concorrente pode vencer; reler antes de atualizar e nunca
      // substituir a associação a outro usuário, mesmo durante reconexões simultâneas.
      for (let attempt = 0; attempt < 2; attempt++) {
        const existing = await database.marketplaceAccount.findUnique({ where, select: { id: true, userId: true } });
        if (existing) {
          if (existing.userId !== userId) throw new AppError("Esta conta Magalu já está vinculada a outro usuário", 409);
          const updated = await database.marketplaceAccount.updateMany({
            where: { id: existing.id, userId, platform: "MAGALU" },
            data: { ...tokens, isActive: true },
          });
          if (updated.count !== 1) throw new AppError("A associação da conta Magalu foi alterada. Inicie uma nova conexão.", 409);
          return;
        }
        try {
          await database.marketplaceAccount.create({
            data: {
              platform: "MAGALU", externalAccountId, userId, ...tokens,
              // O sub oficial serve como identificação visível. Não é um nome
              // comercial inferido; CNPJ permanece nulo até existir fonte oficial.
              name: externalAccountId,
            },
            select: { id: true },
          });
          return;
        } catch (error) {
          if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) throw error;
        }
      }
      throw new AppError("Não foi possível salvar a conexão Magalu. Inicie uma nova conexão.", 409);
    },
  };
}

export const magaluOAuthStorage = createMagaluOAuthStorage();
