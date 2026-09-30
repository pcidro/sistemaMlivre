"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthUserController = void 0;
const authService_1 = require("../../services/auth/authService");
const authSchemas_1 = require("../../schemas/authSchemas");
const THIRTY_DAYS_IN_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;
class AuthUserController {
    async handle(req, res) {
        const credentials = authSchemas_1.loginSchema.parse(req.body);
        const authUserService = new authService_1.AuthUserService();
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
exports.AuthUserController = AuthUserController;
//# sourceMappingURL=authController.js.map