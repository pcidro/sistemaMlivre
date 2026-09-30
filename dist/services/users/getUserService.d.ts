export declare class GetUserService {
    execute(requesterId: string, id: string): Promise<{
        avatarUrl: string | null;
        createdAt: Date;
        email: string;
        id: string;
        name: string;
        role: import("../../generated/prisma/enums").UserRole;
        updatedAt: Date;
        username: string;
    }>;
}
//# sourceMappingURL=getUserService.d.ts.map