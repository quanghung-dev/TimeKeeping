import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import { logger } from "../logging/logger.js";
import { sendError } from "../responses/api-response.js";

interface PostgresError extends Error {
  code?: string;
  constraint?: string;
}

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  if (error instanceof AppError) {
    sendError(response, error.statusCode, error.message, error.details);
    return;
  }

  const postgresError = error as PostgresError;
  if (postgresError.code === "23505") {
    sendError(response, 409, "Du lieu da ton tai", {
      conflict: [postgresError.constraint ?? "unique_constraint"],
    });
    return;
  }

  if (postgresError.code === "23514" || postgresError.code === "23P01") {
    sendError(response, 409, "Du lieu vi pham rang buoc nghiep vu", {
      conflict: [postgresError.constraint ?? "database_constraint"],
    });
    return;
  }

  logger.error(
    { err: error, method: request.method, path: request.path },
    "Unhandled request error",
  );
  sendError(response, 500, "Da xay ra loi khong mong muon", null);
};
