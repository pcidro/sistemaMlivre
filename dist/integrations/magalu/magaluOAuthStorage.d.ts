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
    consumeState(stateHash: string, configFingerprint: string, now: Date): Promise<{
        userId: string;
    } | null>;
    userExists(userId: string): Promise<boolean>;
    saveAccount(authorization: MagaluAccountAuthorization): Promise<void>;
}
export interface MagaluOAuthDatabase {
    user: {
        findUnique(args: {
            where: {
                id: string;
            };
            select: {
                id: true;
            };
        }): Promise<{
            id: string;
        } | null>;
    };
    marketplaceOAuthState: {
        create(args: Prisma.MarketplaceOAuthStateCreateArgs): Promise<unknown>;
        findUnique(args: {
            where: {
                stateHash: string;
            };
        }): Promise<(PendingMagaluAuthorization & {
            platform: MarketplacePlatform;
        }) | null>;
        deleteMany(args: Prisma.MarketplaceOAuthStateDeleteManyArgs): Promise<{
            count: number;
        }>;
    };
    marketplaceAccount: {
        findUnique(args: {
            where: {
                platform_externalAccountId: {
                    platform: "MAGALU";
                    externalAccountId: string;
                };
            };
            select: {
                id: true;
                userId: true;
            };
        }): Promise<{
            id: string;
            userId: string | null;
        } | null>;
        create(args: Prisma.MarketplaceAccountCreateArgs): Promise<unknown>;
        updateMany(args: Prisma.MarketplaceAccountUpdateManyArgs): Promise<{
            count: number;
        }>;
    };
}
export declare function createMagaluOAuthStorage(database?: MagaluOAuthDatabase): MagaluOAuthStorage;
export declare const magaluOAuthStorage: MagaluOAuthStorage;
//# sourceMappingURL=magaluOAuthStorage.d.ts.map