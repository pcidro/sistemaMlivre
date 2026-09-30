import { Request, Response } from "express";
import { UpdateUserService } from "../../services/users/updateUserService";
import { updateUserSchema, userIdParamSchema } from "../../schemas/userSchemas";

export class UpdateUserController {
  async handle(req: Request, res: Response) {
    const { id } = userIdParamSchema.parse(req.params);
    const input = updateUserSchema.parse(req.body);
    const user = await new UpdateUserService().execute(req.user_id, id, input);

    return res.json(user);
  }
}
