import { Request, Response } from "express";
import { MercadoLivreOAuthService } from "../../integrations/mercadolivre/mercadoLivreOAuthService";
export declare class MercadoLivreOAuthController {
    private readonly oauthService;
    constructor(oauthService?: Pick<MercadoLivreOAuthService, "createAuthorization" | "completeAuthorization">);
    connect(req: Request, res: Response): Promise<void>;
    callback(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=mercadoLivreOAuthController.d.ts.map