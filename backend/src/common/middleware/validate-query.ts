import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { ValidationError } from "../errors/app-error.js";

export function validateQuery(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      const details: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".") || "query";
        (details[path] ??= []).push(issue.message);
      }
      next(new ValidationError(details));
      return;
    }
    for (const key of Object.keys(request.query)) {
      delete request.query[key];
    }
    Object.assign(request.query, result.data);
    next();
  };
}
