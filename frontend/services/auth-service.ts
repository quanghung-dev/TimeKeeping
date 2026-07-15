import { apiRequest, resetApiSessionState } from "@/lib/api/client";
import type { AuthPayload, UserProfile } from "@/types/api";

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  timezone: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authService = {
  register: (input: RegisterInput) =>
    apiRequest<AuthPayload>("/auth/register", { method: "POST", body: input, skipRefresh: true }),
  login: (input: LoginInput) =>
    apiRequest<AuthPayload>("/auth/login", { method: "POST", body: input, skipRefresh: true }),
  me: () => apiRequest<UserProfile>("/auth/me"),
  forgotPassword: (email: string) =>
    apiRequest<Record<string, never>>("/auth/forgot-password", {
      method: "POST",
      body: { email },
      skipRefresh: true,
    }),
  resetPassword: (token: string, newPassword: string) =>
    apiRequest<Record<string, never>>("/auth/reset-password", {
      method: "POST",
      body: { token, newPassword },
      skipRefresh: true,
    }),
  async logout() {
    await apiRequest<Record<string, never>>("/auth/logout", { method: "POST", skipRefresh: true });
    resetApiSessionState();
  },
};
