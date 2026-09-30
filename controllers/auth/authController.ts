import { Request, Response } from "express";

import { AuthUserService } from "../../services/auth/authService";
import { loginSchema } from "../../schemas/authSchemas";

const THIRTY_DAYS_IN_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

export class AuthUserController {
  async handle(req: Request, res: Response) {
    const credentials = loginSchema.parse(req.body);

    const authUserService = new AuthUserService();
    const { token, user } = await authUserService.execute(credentials);

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: THIRTY_DAYS_IN_MILLISECONDS,
      path: "/",
    });

    return res.json(user);
  }
}
