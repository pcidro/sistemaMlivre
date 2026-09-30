import { CreateUserInput } from "../../schemas/userSchemas";
export declare class CreateUserService {
    execute(input: CreateUserInput): Promise<{
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
//# sourceMappingURL=createUserService.d.ts.map