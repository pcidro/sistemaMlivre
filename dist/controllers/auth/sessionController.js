"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionController = void 0;
const AppError_1 = require("../../errors/AppError");
const prisma_1 = require("../../lib/prisma");
const userUtils_1 = require("../../services/users/userUtils");
const findCurrentUser = async (id) => prisma_1.prisma.user.findUnique({ where: { id }, select: userUtils_1.publicUserSelect });
/** Usa a autenticação existente; não cria nem renova tokens. */
class SessionController {
    findUser;
    constructor(findUser = findCurrentUser) {
        this.findUser = findUser;
    }
    async me(req, res) {
        const user = await this.findUser(req.user_id);
        if (!user)
            throw new AppError_1.AppError("Sessão inválida. Entre novamente", 401);
        res.set("Cache-Control", "private, no-store");
        return res.json(user);
    }
    logout(_req, res) {
        const isProduction = process.env.NODE_ENV === "production";
        res.clearCookie("auth_token", {
            httpOnly: true, secure: isProduction,
            sameSite: isProduction ? "none" : "lax", path: "/",
        });
        res.set("Cache-Control", "private, no-store");
        return res.status(204).send();
    }
}
exports.SessionController = SessionController;
//# sourceMappingURL=sessionController.js.map