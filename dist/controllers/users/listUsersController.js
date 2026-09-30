"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListUsersController = void 0;
const listUsersService_1 = require("../../services/users/listUsersService");
const userSchemas_1 = require("../../schemas/userSchemas");
class ListUsersController {
    async handle(req, res) {
        const query = userSchemas_1.listUsersQuerySchema.parse(req.query);
        const result = await new listUsersService_1.ListUsersService().execute(req.user_id, query);
        return res.json(result);
    }
}
exports.ListUsersController = ListUsersController;
//# sourceMappingURL=listUsersController.js.map