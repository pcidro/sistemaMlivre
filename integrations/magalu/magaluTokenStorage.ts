import type { MarketplaceAccount, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { MagaluHttpError } from "./magaluHttpError";

export type MagaluTokenAccount = Pick<MarketplaceAccount, "id" | "platform" | "externalAccountId" |
  "userId" | "isActive" | "accessTokenEncrypted" | "refreshTokenEncrypted" | "tokenExpiresAt">;

export interface MagaluSavedTokens {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: Date;
}

export interface MagaluTokenStorage {
  findAccount(id: string): Promise<MagaluTokenAccount | null>;
  withLockedAccount<T>(id: string, work: (
    account: MagaluTokenAccount | null,
    save: (tokens: MagaluSavedTokens) => Promise<void>,
  ) => Promise<T>): Promise<T>;
}

const credentialsSelect = {
  id: true, platform: true, externalAccountId: true, userId: true, isActive: true,
  accessTokenEncrypted: true, refreshTokenEncrypted: true, tokenExpiresAt: true,
} as const;

interface TokenAccountQueries {
  findUnique(args: { where: { id: string }; select: typeof credentialsSelect }): Promise<MagaluTokenAccount | null>;
  updateMany(args: Prisma.MarketplaceAccountUpdateManyArgs): Promise<{ count: number }>;
}

export interface MagaluTokenDatabase {
  marketplaceAccount: TokenAccountQueries;
  $transaction<T>(work: (tx: {
    $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
    marketplaceAccount: TokenAccountQueries;
  }) => Promise<T>, options: { maxWait: number; timeout: number }): Promise<T>;
}

export function createMagaluTokenStorage(database: MagaluTokenDatabase = prisma): MagaluTokenStorage {
  return {
    findAccount: (id) => database.marketplaceAccount.findUnique({ where: { id }, select: credentialsSelect }),
    async withLockedAccount(id, work) {
      return database.$transaction(async (tx) => {
        // Serializa refresh por conta também entre processos. Parametrização evita
        // interpolação de IDs em SQL; nenhuma transação do Mercado Livre é alterada.
        await tx.$queryRaw`SELECT id FROM marketplace_accounts WHERE id = ${id} FOR UPDATE`;
        const account = await tx.marketplaceAccount.findUnique({ where: { id }, select: credentialsSelect });
        return work(account, async (tokens) => {
          if (!account) throw new MagaluHttpError("Conta Magalu não encontrada ou inativa.", 404, "invalid_account");
          const updated = await tx.marketplaceAccount.updateMany({
            where: { id, platform: "MAGALU", isActive: true, userId: account.userId,
              accessTokenEncrypted: account.accessTokenEncrypted, refreshTokenEncrypted: account.refreshTokenEncrypted },
            // Uma única atualização atômica: nunca limpar o refresh antes de salvar.
            data: tokens,
          });
          if (updated.count !== 1) throw new MagaluHttpError("A conta Magalu foi alterada durante a renovação.", 409, "account_changed");
        });
      }, { maxWait: 10_000, timeout: 25_000 });
    },
  };
}

export const magaluTokenStorage = createMagaluTokenStorage();
