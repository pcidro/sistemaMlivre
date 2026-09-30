"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticated = isAuthenticated;
const jsonwebtoken_1 = require("jsonwebtoken");
const AppError_1 = require("../errors/AppError");
function readCookie(req, name) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader)
        return undefined;
    for (const cookie of cookieHeader.split(";")) {
        const [cookieName, ...valueParts] = cookie.trim().split("=");
        if (cookieName === name) {
            return decodeURIComponent(valueParts.join("="));
        }
    }
    return undefined;
}
function getToken(req) {
    const authorization = req.headers.authorization;
    if (authorization) {
        const [scheme, token] = authorization.split(" ");
        if (scheme?.toLowerCase() === "bearer" && token) {
            return token;
        }
    }
    return readCookie(req, "auth_token");
}
function isAuthenticated(req, _res, next) {
    const token = getToken(req);
    const jwtSecret = process.env.JWT_SECRET;
    if (!token) {
        throw new AppError_1.AppError("Token de autenticação ausente", 401);
    }
    if (!jwtSecret) {
        throw new AppError_1.AppError("Configuração de autenticação ausente", 500);
    }
    try {
        const payload = (0, jsonwebtoken_1.verify)(token, jwtSecret);
        if (!payload.sub || typeof payload.sub !== "string") {
            throw new Error("Invalid token subject");
        }
        req.user_id = payload.sub;
        return next();
    }
    catch {
        throw new AppError_1.AppError("Token de autenticação inválido ou expirado", 401);
    }
}
//# sourceMappingURL=isAuthenticated.js.map