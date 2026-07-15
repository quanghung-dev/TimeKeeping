import type { Response } from "express";
import type { ErrorDetails } from "../errors/app-error.js";

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: ErrorDetails | null;
  timestamp: string;
}

export function sendSuccess<T>(
  response: Response,
  data: T,
  message = "Thanh cong",
  statusCode = 200,
): void {
  response.status(statusCode).json({
    success: true,
    message,
    data,
    errors: null,
    timestamp: new Date().toISOString(),
  } satisfies ApiEnvelope<T>);
}

export function sendError(
  response: Response,
  statusCode: number,
  message: string,
  errors: ErrorDetails | null,
): void {
  response.status(statusCode).json({
    success: false,
    message,
    data: null,
    errors,
    timestamp: new Date().toISOString(),
  } satisfies ApiEnvelope<never>);
}
