import type { Request, Response } from "express";
declare const findCurrentUser: (id: string) => Promise<{
    avatarUrl: string | null;
    createdAt: Date;
    email: string;
    id: string;
    name: string;
    role: import("../../generated/prisma/enums").UserRole;
    updatedAt: Date;
    username: string;
} | null>;
/** Usa a autenticação existente; não cria nem renova tokens. */
export declare class SessionController {
    private readonly findUser;
    constructor(findUser?: typeof findCurrentUser);
    me(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    logout(_req: Request, res: Response): Response<any, Record<string, any>>;
}
export {};
//# sourceMappingURL=sessionController.d.ts.map