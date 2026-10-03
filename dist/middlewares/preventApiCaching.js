"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preventApiCaching = void 0;
// Inclui erros e redirects OAuth para não armazenar sessões/dados no proxy do frontend.
const preventApiCaching = (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
};
exports.preventApiCaching = preventApiCaching;
//# sourceMappingURL=preventApiCaching.js.map