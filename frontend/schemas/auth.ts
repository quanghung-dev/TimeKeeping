import { z } from "zod";

const password = z
  .string()
  .min(10, "Mật khẩu cần ít nhất 10 ký tự")
  .regex(/[a-z]/, "Cần ít nhất một chữ thường")
  .regex(/[A-Z]/, "Cần ít nhất một chữ hoa")
  .regex(/[0-9]/, "Cần ít nhất một chữ số")
  .regex(/[^a-zA-Z0-9]/, "Cần ít nhất một ký tự đặc biệt");

export const loginSchema = z.object({
  email: z.email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, "Tên cần ít nhất 2 ký tự").max(100),
    email: z.email("Email không hợp lệ"),
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu xác nhận không khớp",
  });

export const forgotPasswordSchema = z.object({ email: z.email("Email không hợp lệ") });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
