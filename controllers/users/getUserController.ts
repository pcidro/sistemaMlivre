import { Request, Response } from "express";
import { GetUserService } from "../../services/users/getUserService";
import { userIdParamSchema } from "../../schemas/userSchemas";

export class GetUserController {
  async handle(req: Request, res: Response) {
    const { id } = userIdParamSchema.parse(req.params);
    const user = await new GetUserService().execute(req.user_id, id);

    return res.json(user);
  }
}
