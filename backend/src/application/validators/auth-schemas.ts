import { z } from "zod";

const passwordSchema = z
  .string()
  .min(10, "Mat khau phai co it nhat 10 ky tu")
  .max(128, "Mat khau qua dai")
  .regex(/[a-z]/, "Mat khau phai co chu thuong")
  .regex(/[A-Z]/, "Mat khau phai co chu hoa")
  .regex(/[0-9]/, "Mat khau phai co chu so")
  .regex(/[^a-zA-Z0-9]/, "Mat khau phai co ky tu dac biet");

export const registerSchema = z.object({
  email: z.email().max(255),
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(100),
  timezone: z.string().trim().min(1).max(100).default("Asia/Ho_Chi_Minh"),
});

export const loginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.email().max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(4096),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
