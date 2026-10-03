import type { Request, Response } from "express";

import { importBodySchema } from "../../schemas/importSchemas";
import { MagaluImportService } from "../../services/imports/MagaluImportService";

export class MagaluImportController {
  constructor(private readonly service: Pick<MagaluImportService, "execute"> = new MagaluImportService()) {}

  async handle(req: Request, res: Response) {
    const body = importBodySchema.parse(req.body);
    const summary = await this.service.execute({ ...body, userId: req.user_id });
    return res.json(summary);
  }
}
