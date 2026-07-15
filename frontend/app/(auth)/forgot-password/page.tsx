import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Quên mật khẩu" };
export default function ForgotPasswordPage() {
  return <AuthShell title="Khôi phục mật khẩu" description="Nhập email để nhận liên kết đặt lại mật khẩu."><ForgotPasswordForm /></AuthShell>;
}
