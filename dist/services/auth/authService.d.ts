interface AuthUserServiceProps {
    email: string;
    password: string;
}
export declare class AuthUserService {
    execute({ email, password }: AuthUserServiceProps): Promise<{
        token: string;
        user: {
            id: string;
            name: string;
            username: string;
            email: string;
            avatarUrl: string | null;
            role: import("../../generated/prisma/enums").UserRole;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
}
export {};
//# sourceMappingURL=authService.d.ts.map