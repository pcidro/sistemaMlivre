import type { Request, Response } from "express";

import { DashboardService } from "../../services/dashboard/DashboardService";

export class DashboardController {
  constructor(private readonly service: Pick<DashboardService, "execute"> = new DashboardService()) {}

  async handle(req: Request, res: Response) {
    const summary = await this.service.execute(req.user_id);
    res.set("Cache-Control", "private, no-store");
    return res.json(summary);
  }
}
