export declare const publicUserSelect: {
    readonly id: true;
    readonly name: true;
    readonly username: true;
    readonly email: true;
    readonly avatarUrl: true;
    readonly role: true;
    readonly createdAt: true;
    readonly updatedAt: true;
};
export declare function ensureAuthenticatedUser(userId: string): Promise<{
    id: string;
    role: import("../../generated/prisma/enums").UserRole;
}>;
export declare function ensureCanManageUser(requesterId: string, targetId: string): Promise<void>;
export declare function findConflictingUser(email: string | undefined, username: string | undefined, excludeId?: string): Promise<{
    email: string;
    username: string;
} | null>;
export declare function throwConflict(conflict: {
    email: string;
    username: string;
} | null, email?: string): void;
//# sourceMappingURL=userUtils.d.ts.map