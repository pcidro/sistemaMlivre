import type { Request, Response } from "express";

import { mercadoLivreImportBodySchema } from "../../schemas/importSchemas";
import { MercadoLivreImportService } from "../../services/imports/MercadoLivreImportService";

export class MercadoLivreImportController {
  constructor(private readonly service: Pick<MercadoLivreImportService, "execute"> = new MercadoLivreImportService()) {}

  async handle(req: Request, res: Response) {
    const body = mercadoLivreImportBodySchema.parse(req.body);
    const summary = await this.service.execute({ ...body, userId: req.user_id });
    return res.json(summary);
  }
}
