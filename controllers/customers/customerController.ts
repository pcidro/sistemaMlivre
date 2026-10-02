import type { Request, Response } from "express";

import { customerIdSchema } from "../../schemas/customerSchemas";
import { CustomerQueryService } from "../../services/customers/CustomerQueryService";

export class CustomerController {
  constructor(private readonly service: Pick<CustomerQueryService, "list" | "get"> = new CustomerQueryService()) {}

  async list(req: Request, res: Response) {
    const result = await this.service.list(req.user_id, req.query);
    res.set("Cache-Control", "private, no-store");
    return res.json(result);
  }

  async get(req: Request, res: Response) {
    const id = customerIdSchema.parse(req.params.id);
    const customer = await this.service.get(req.user_id, id);
    res.set("Cache-Control", "private, no-store");
    return res.json(customer);
  }
}
