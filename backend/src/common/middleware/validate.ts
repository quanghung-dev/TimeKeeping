import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { ValidationError, type ErrorDetails } from "../errors/app-error.js";

export function validateBody(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      const details: ErrorDetails = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join(".") || "body";
        (details[field] ??= []).push(issue.message);
      }
      next(new ValidationError(details));
      return;
    }

    request.body = parsed.data;
    next();
  };
}
