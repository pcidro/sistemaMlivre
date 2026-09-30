"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateUserController = void 0;
const updateUserService_1 = require("../../services/users/updateUserService");
const userSchemas_1 = require("../../schemas/userSchemas");
class UpdateUserController {
    async handle(req, res) {
        const { id } = userSchemas_1.userIdParamSchema.parse(req.params);
        const input = userSchemas_1.updateUserSchema.parse(req.body);
        const user = await new updateUserService_1.UpdateUserService().execute(req.user_id, id, input);
        return res.json(user);
    }
}
exports.UpdateUserController = UpdateUserController;
//# sourceMappingURL=updateUserController.js.map