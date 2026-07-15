import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Đăng ký" };
export default function RegisterPage() {
  return <AuthShell title="Tạo tài khoản" description="Thiết lập không gian chấm công riêng tư của bạn."><RegisterForm /></AuthShell>;
}
