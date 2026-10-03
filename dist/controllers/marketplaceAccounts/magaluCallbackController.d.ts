import type { Request, Response } from "express";
import { MagaluOAuthService } from "../../integrations/magalu/MagaluOAuthService";
export declare function sendMagaluCallbackResponse(res: Response, status: number, message: string, connected?: boolean): Response<any, Record<string, any>>;
export declare class MagaluCallbackController {
    private readonly service;
    constructor(service?: Pick<MagaluOAuthService, "createAuthorization" | "completeAuthorization">);
    connect(req: Request, res: Response): Promise<void | Response<any, Record<string, any>>>;
    handle(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    private cookieOptions;
    private readStateCookie;
    private failure;
}
//# sourceMappingURL=magaluCallbackController.d.ts.map