import type { Request, Response } from "express";
import type { ChangePasswordInput, ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from "../application/validators/auth-schemas.js";
import { AuthService, type AuthRequestContext } from "../application/services/auth-service.js";
import { requireUserId } from "../common/middleware/auth.js";
import { sendSuccess } from "../common/responses/api-response.js";
import {
  clearAuthCookies,
  issueCsrfToken,
  REFRESH_COOKIE,
  setAuthCookies,
} from "../infrastructure/authentication/cookies.js";

function requestContext(request: Request): AuthRequestContext {
  return {
    ip: request.ip ?? request.socket.remoteAddress ?? "unknown",
    userAgent: request.get("user-agent") ?? "unknown",
  };
}

function refreshCookie(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, unknown>;
  const value = cookies[REFRESH_COOKIE];
  return typeof value === "string" ? value : undefined;
}

export class AuthController {
  static async csrf(_request: Request, response: Response): Promise<void> {
    sendSuccess(response, { csrfToken: issueCsrfToken(response) }, "Da tao CSRF token");
  }

  static async register(request: Request, response: Response): Promise<void> {
    const result = await AuthService.register(request.body as RegisterInput, requestContext(request));
    setAuthCookies(response, result.accessToken, result.refreshToken);
    sendSuccess(response, { user: result.user }, "Dang ky thanh cong", 201);
  }

  static async login(request: Request, response: Response): Promise<void> {
    const result = await AuthService.login(request.body as LoginInput, requestContext(request));
    setAuthCookies(response, result.accessToken, result.refreshToken);
    sendSuccess(response, { user: result.user }, "Dang nhap thanh cong");
  }

  static async refresh(request: Request, response: Response): Promise<void> {
    const token = refreshCookie(request);
    if (!token) {
      clearAuthCookies(response);
      throw new (await import("../common/errors/app-error.js")).AppError(
        401,
        "REFRESH_TOKEN_MISSING",
        "Thieu refresh token",
      );
    }
    const result = await AuthService.refresh(token, requestContext(request));
    setAuthCookies(response, result.accessToken, result.refreshToken);
    sendSuccess(response, { user: result.user }, "Lam moi phien dang nhap thanh cong");
  }

  static async logout(request: Request, response: Response): Promise<void> {
    await AuthService.logout(refreshCookie(request));
    clearAuthCookies(response);
    sendSuccess(response, {}, "Dang xuat thanh cong");
  }

  static async me(request: Request, response: Response): Promise<void> {
    sendSuccess(response, await AuthService.me(requireUserId(request)), "Lay thong tin nguoi dung thanh cong");
  }

  static async changePassword(request: Request, response: Response): Promise<void> {
    await AuthService.changePassword(requireUserId(request), request.body as ChangePasswordInput);
    clearAuthCookies(response);
    sendSuccess(response, {}, "Doi mat khau thanh cong, vui long dang nhap lai");
  }

  static async forgotPassword(request: Request, response: Response): Promise<void> {
    await AuthService.forgotPassword(request.body as ForgotPasswordInput);
    sendSuccess(response, {}, "Neu email ton tai, huong dan dat lai mat khau da duoc gui");
  }

  static async resetPassword(request: Request, response: Response): Promise<void> {
    await AuthService.resetPassword(request.body as ResetPasswordInput);
    clearAuthCookies(response);
    sendSuccess(response, {}, "Dat lai mat khau thanh cong");
  }
}
