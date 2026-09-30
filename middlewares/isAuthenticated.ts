import { NextFunction, Request, Response } from "express";
import { JwtPayload, verify } from "jsonwebtoken";

import { AppError } from "../errors/AppError";

function readCookie(req: Request, name: string) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = cookie.trim().split("=");

    if (cookieName === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return undefined;
}

function getToken(req: Request) {
  const authorization = req.headers.authorization;

  if (authorization) {
    const [scheme, token] = authorization.split(" ");

    if (scheme?.toLowerCase() === "bearer" && token) {
      return token;
    }
  }

  return readCookie(req, "auth_token");
}

export function isAuthenticated(req: Request, _res: Response, next: NextFunction) {
  const token = getToken(req);
  const jwtSecret = process.env.JWT_SECRET;

  if (!token) {
    throw new AppError("Token de autenticação ausente", 401);
  }

  if (!jwtSecret) {
    throw new AppError("Configuração de autenticação ausente", 500);
  }

  try {
    const payload = verify(token, jwtSecret) as JwtPayload;

    if (!payload.sub || typeof payload.sub !== "string") {
      throw new Error("Invalid token subject");
    }

    req.user_id = payload.sub;
    return next();
  } catch {
    throw new AppError("Token de autenticação inválido ou expirado", 401);
  }
}
