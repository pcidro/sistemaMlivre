"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.magaluCallbackQuerySchema = void 0;
const zod_1 = require("zod");
const callbackValue = zod_1.z.string().min(1).max(2048).regex(/^[^\s\x00-\x1f\x7f]+$/);
exports.magaluCallbackQuerySchema = zod_1.z.union([
    zod_1.z.object({ code: callbackValue, state: callbackValue }).strict(),
    zod_1.z.object({
        error: zod_1.z.string().min(1).max(100).regex(/^[a-zA-Z0-9_]+$/),
        state: callbackValue,
        error_description: zod_1.z.string().max(1024).optional(),
        error_uri: zod_1.z.string().max(2048).optional(),
    }).strict(),
]);
//# sourceMappingURL=magaluCallbackSchemas.js.map