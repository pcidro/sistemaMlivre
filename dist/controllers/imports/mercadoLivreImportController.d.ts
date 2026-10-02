import type { Request, Response } from "express";
import { MercadoLivreImportService } from "../../services/imports/MercadoLivreImportService";
export declare class MercadoLivreImportController {
    private readonly service;
    constructor(service?: Pick<MercadoLivreImportService, "execute">);
    handle(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=mercadoLivreImportController.d.ts.map