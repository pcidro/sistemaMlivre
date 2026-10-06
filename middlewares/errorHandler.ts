import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";

const internalErrorReasons: Record<string, string> = {
  P1000: "database_authentication_failed",
  P1001: "database_unreachable",
  P1002: "database_timeout",
  P1017: "database_connection_closed",
  P2021: "database_table_missing",
  P2022: "database_column_missing",
  P2024: "database_pool_timeout",
  P2025: "database_record_missing",
  P2002: "database_unique_conflict",
  P2034: "database_transaction_conflict",
  ECONNREFUSED: "connection_refused",
  ETIMEDOUT: "connection_timeout",
};

function safeInternalErrorDetails(error: Error, req: Request) {
  const candidate = "code" in error ? error.code : null;
  const code = typeof candidate === "string" && Object.hasOwn(internalErrorReasons, candidate) ? candidate : null;
  // Registra apenas áreas fixas; paths, queries, IDs e headers não são copiados.
  const areas = ["imports", "marketplace-accounts", "customers", "dashboard", "auth", "users"] as const;
  const area = typeof req.path === "string"
    ? areas.find(value => req.path === `/api/${value}` || req.path.startsWith(`/api/${value}/`)) ?? null
    : null;
  const method = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(req.method) ? req.method : null;
  return { reason: code ? internalErrorReasons[code] : "unexpected", code, area, method };
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Dados inválidos",
      issues: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  // Mensagens de drivers e provedores podem conter credenciais, XML ou dados pessoais.
  console.error("internal_server_error", safeInternalErrorDetails(err, req));
  return res.status(500).json({
    error: "Erro interno no servidor",
  });
}
