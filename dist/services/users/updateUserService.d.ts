import { UpdateUserInput } from "../../schemas/userSchemas";
export declare class UpdateUserService {
    execute(requesterId: string, id: string, input: UpdateUserInput): Promise<{
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
//# sourceMappingURL=updateUserService.d.ts.map