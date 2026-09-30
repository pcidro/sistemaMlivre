"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteUserController = void 0;
const deleteUserService_1 = require("../../services/users/deleteUserService");
const userSchemas_1 = require("../../schemas/userSchemas");
class DeleteUserController {
    async handle(req, res) {
        const { id } = userSchemas_1.userIdParamSchema.parse(req.params);
        await new deleteUserService_1.DeleteUserService().execute(req.user_id, id);
        return res.status(204).send();
    }
}
exports.DeleteUserController = DeleteUserController;
//# sourceMappingURL=deleteUserController.js.map