import { Router } from "express";
import { CreateUserController } from "../controllers/users/createUserController";
import { DeleteUserController } from "../controllers/users/deleteUserController";
import { GetUserController } from "../controllers/users/getUserController";
import { ListUsersController } from "../controllers/users/listUsersController";
import { UpdateUserController } from "../controllers/users/updateUserController";
import { isAuthenticated } from "../middlewares/isAuthenticated";

const userRoutes = Router();

const createUserController = new CreateUserController();
const listUsersController = new ListUsersController();
const getUserController = new GetUserController();
const updateUserController = new UpdateUserController();
const deleteUserController = new DeleteUserController();

userRoutes.post("/", (req, res) => createUserController.handle(req, res));
userRoutes.get("/", isAuthenticated, (req, res) =>
  listUsersController.handle(req, res),
);
userRoutes.get("/:id", isAuthenticated, (req, res) =>
  getUserController.handle(req, res),
);
userRoutes.put("/:id", isAuthenticated, (req, res) =>
  updateUserController.handle(req, res),
);
userRoutes.delete("/:id", isAuthenticated, (req, res) =>
  deleteUserController.handle(req, res),
);

export { userRoutes };
export default userRoutes;
