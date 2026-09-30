import { Request, Response } from "express";
import { CreateUserService } from "../../services/users/createUserService";
import { createUserSchema } from "../../schemas/userSchemas";

export class CreateUserController {
  async handle(req: Request, res: Response) {
    const input = createUserSchema.parse(req.body);
    const user = await new CreateUserService().execute(input);

    return res.status(201).json(user);
  }
}
