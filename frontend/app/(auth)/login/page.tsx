import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Đăng nhập" };
export default function LoginPage() {
  return <AuthShell title="Chào mừng trở lại" description="Đăng nhập để tiếp tục theo dõi ngày làm việc của bạn."><LoginForm /></AuthShell>;
}
