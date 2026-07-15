import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { ValidationError, type ErrorDetails } from "../errors/app-error.js";

export function validateParams(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const parsed = schema.safeParse(request.params);
    if (!parsed.success) {
      const details: ErrorDetails = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join(".") || "params";
        (details[field] ??= []).push(issue.message);
      }
      next(new ValidationError(details));
      return;
    }
    for (const key of Object.keys(request.params)) {
      delete request.params[key];
    }
    Object.assign(request.params, parsed.data);
    next();
  };
}
