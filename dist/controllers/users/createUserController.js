"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateUserController = void 0;
const createUserService_1 = require("../../services/users/createUserService");
const userSchemas_1 = require("../../schemas/userSchemas");
class CreateUserController {
    async handle(req, res) {
        const input = userSchemas_1.createUserSchema.parse(req.body);
        const user = await new createUserService_1.CreateUserService().execute(input);
        return res.status(201).json(user);
    }
}
exports.CreateUserController = CreateUserController;
//# sourceMappingURL=createUserController.js.map