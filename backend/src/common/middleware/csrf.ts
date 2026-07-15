import type { RequestHandler } from "express";
import { verifyCsrf } from "../../infrastructure/authentication/cookies.js";

export const csrfProtection: RequestHandler = (request, _response, next) => {
  try {
    verifyCsrf(request);
    next();
  } catch (error) {
    next(error);
  }
};
