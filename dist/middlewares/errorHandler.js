"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const AppError_1 = require("../errors/AppError");
function errorHandler(err, _req, res, _next) {
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            error: "Dados inválidos",
            issues: err.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            })),
        });
    }
    if (err instanceof AppError_1.AppError) {
        return res.status(err.statusCode).json({
            error: err.message,
        });
    }
    console.error("Internal Server Error:", err.message);
    return res.status(500).json({
        error: "Erro interno no servidor",
    });
}
//# sourceMappingURL=errorHandler.js.map