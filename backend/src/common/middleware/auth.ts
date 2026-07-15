import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import { ACCESS_COOKIE } from "../../infrastructure/authentication/cookies.js";
import { verifyAccessToken } from "../../infrastructure/authentication/token-service.js";

export const requireAuth: RequestHandler = (request, _response, next) => {
  const cookies = request.cookies as Record<string, unknown>;
  const token = cookies[ACCESS_COOKIE];
  if (typeof token !== "string") {
    next(new AppError(401, "AUTHENTICATION_REQUIRED", "Ban chua dang nhap"));
    return;
  }

  void verifyAccessToken(token)
    .then((payload) => {
      request.authUser = { id: payload.userId, email: payload.email };
      next();
    })
    .catch(next);
};

export function requireUserId(request: Express.Request): string {
  if (!request.authUser) {
    throw new AppError(401, "AUTHENTICATION_REQUIRED", "Ban chua dang nhap");
  }
  return request.authUser.id;
}
