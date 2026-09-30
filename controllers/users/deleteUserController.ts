import { Request, Response } from "express";
import { DeleteUserService } from "../../services/users/deleteUserService";
import { userIdParamSchema } from "../../schemas/userSchemas";

export class DeleteUserController {
  async handle(req: Request, res: Response) {
    const { id } = userIdParamSchema.parse(req.params);
    await new DeleteUserService().execute(req.user_id, id);

    return res.status(204).send();
  }
}
