"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetUserController = void 0;
const getUserService_1 = require("../../services/users/getUserService");
const userSchemas_1 = require("../../schemas/userSchemas");
class GetUserController {
    async handle(req, res) {
        const { id } = userSchemas_1.userIdParamSchema.parse(req.params);
        const user = await new getUserService_1.GetUserService().execute(req.user_id, id);
        return res.json(user);
    }
}
exports.GetUserController = GetUserController;
//# sourceMappingURL=getUserController.js.map