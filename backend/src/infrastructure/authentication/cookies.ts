import { randomBytes, timingSafeEqual } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { getEnv } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";

export const ACCESS_COOKIE = "tk_access";
export const REFRESH_COOKIE = "tk_refresh";
export const CSRF_COOKIE = "tk_csrf";

function baseCookie(path: string): CookieOptions {
  return {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "lax",
    path,
  };
}

export function setAuthCookies(response: Response, accessToken: string, refreshToken: string): void {
  const env = getEnv();
  response.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookie("/api"),
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60_000,
  });
  response.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookie("/api/auth"),
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
  });
}

export function clearAuthCookies(response: Response): void {
  response.clearCookie(ACCESS_COOKIE, baseCookie("/api"));
  response.clearCookie(REFRESH_COOKIE, baseCookie("/api/auth"));
}

export function issueCsrfToken(response: Response): string {
  const token = randomBytes(32).toString("base64url");
  response.cookie(CSRF_COOKIE, token, {
    ...baseCookie("/api"),
    maxAge: 8 * 60 * 60 * 1000,
  });
  return token;
}

export function verifyCsrf(request: Request): void {
  const cookies = request.cookies as Record<string, unknown>;
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = request.header("x-csrf-token");
  if (typeof cookieToken !== "string" || !headerToken) {
    throw new AppError(403, "CSRF_TOKEN_MISSING", "Thieu CSRF token");
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  if (cookieBuffer.length !== headerBuffer.length || !timingSafeEqual(cookieBuffer, headerBuffer)) {
    throw new AppError(403, "CSRF_TOKEN_INVALID", "CSRF token khong hop le");
  }
}
