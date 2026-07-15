"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/schemas/auth";
import { authService } from "@/services/auth-service";
import { FormError } from "./form-error";

export function ForgotPasswordForm() {
  const form = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const mutation = useMutation({ mutationFn: ({ email }: ForgotPasswordFormValues) => authService.forgotPassword(email) });
  const error = mutation.error instanceof ApiError ? mutation.error.message : mutation.error ? "Không thể kết nối máy chủ" : null;

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
      <FormError message={error} />
      {mutation.isSuccess && <p className="rounded-lg bg-status-success/10 p-3 text-sm text-status-success">Hãy kiểm tra email để tiếp tục đặt lại mật khẩu.</p>}
      <div className="space-y-2">
        <Label htmlFor="email">Email tài khoản</Label>
        <Input id="email" type="email" inputMode="email" autoComplete="email" {...form.register("email")} aria-invalid={Boolean(form.formState.errors.email)} />
        {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
      </div>
      <Button className="w-full" size="lg" disabled={mutation.isPending}>{mutation.isPending ? "Đang gửi…" : "Gửi hướng dẫn"}</Button>
      <p className="text-center text-sm"><Link href="/login" className="text-primary hover:underline">Quay lại đăng nhập</Link></p>
    </form>
  );
}
