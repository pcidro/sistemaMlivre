import { Request, Response } from "express";
import { ListUsersService } from "../../services/users/listUsersService";
import { listUsersQuerySchema } from "../../schemas/userSchemas";

export class ListUsersController {
  async handle(req: Request, res: Response) {
    const query = listUsersQuerySchema.parse(req.query);
    const result = await new ListUsersService().execute(req.user_id, query);

    return res.json(result);
  }
}
