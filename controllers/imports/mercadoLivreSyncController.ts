import type { Request, Response } from "express";
import { z } from "zod";
import { mercadoLivreSyncService, type MercadoLivreSyncService } from "../../services/imports/MercadoLivreSyncService";

export class MercadoLivreSyncController {
  constructor(private readonly service: Pick<MercadoLivreSyncService, "start" | "list" | "get"> = mercadoLivreSyncService) {}
  async start(req: Request, res: Response) {
    const { marketplaceAccountId } = z.object({ marketplaceAccountId: z.uuid() }).strict().parse(req.body);
    return res.status(202).json(await this.service.start(marketplaceAccountId, req.user_id));
  }
  async list(req: Request, res: Response) { return res.json(await this.service.list(req.user_id)); }
  async get(req: Request, res: Response) {
    const id = z.uuid().parse(req.params.id);
    return res.json(await this.service.get(id, req.user_id));
  }
}
