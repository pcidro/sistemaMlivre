import type { MarketplaceAccount, Prisma } from "../../generated/prisma/client";
export type MagaluTokenAccount = Pick<MarketplaceAccount, "id" | "platform" | "externalAccountId" | "userId" | "isActive" | "accessTokenEncrypted" | "refreshTokenEncrypted" | "tokenExpiresAt">;
export interface MagaluSavedTokens {
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string;
    tokenExpiresAt: Date;
}
export interface MagaluTokenStorage {
    findAccount(id: string): Promise<MagaluTokenAccount | null>;
    withLockedAccount<T>(id: string, work: (account: MagaluTokenAccount | null, save: (tokens: MagaluSavedTokens) => Promise<void>) => Promise<T>): Promise<T>;
}
declare const credentialsSelect: {
    readonly id: true;
    readonly platform: true;
    readonly externalAccountId: true;
    readonly userId: true;
    readonly isActive: true;
    readonly accessTokenEncrypted: true;
    readonly refreshTokenEncrypted: true;
    readonly tokenExpiresAt: true;
};
interface TokenAccountQueries {
    findUnique(args: {
        where: {
            id: string;
        };
        select: typeof credentialsSelect;
    }): Promise<MagaluTokenAccount | null>;
    updateMany(args: Prisma.MarketplaceAccountUpdateManyArgs): Promise<{
        count: number;
    }>;
}
export interface MagaluTokenDatabase {
    marketplaceAccount: TokenAccountQueries;
    $transaction<T>(work: (tx: {
        $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
        marketplaceAccount: TokenAccountQueries;
    }) => Promise<T>, options: {
        maxWait: number;
        timeout: number;
    }): Promise<T>;
}
export declare function createMagaluTokenStorage(database?: MagaluTokenDatabase): MagaluTokenStorage;
export declare const magaluTokenStorage: MagaluTokenStorage;
export {};
//# sourceMappingURL=magaluTokenStorage.d.ts.map