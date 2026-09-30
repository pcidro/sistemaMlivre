import { ListUsersInput } from "../../schemas/userSchemas";
export declare class ListUsersService {
    execute(requesterId: string, { page, limit, search }: ListUsersInput): Promise<{
        data: {
            avatarUrl: string | null;
            createdAt: Date;
            email: string;
            id: string;
            name: string;
            role: import("../../generated/prisma/enums").UserRole;
            updatedAt: Date;
            username: string;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
}
//# sourceMappingURL=listUsersService.d.ts.map