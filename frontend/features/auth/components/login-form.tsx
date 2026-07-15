"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { loginSchema, type LoginFormValues } from "@/schemas/auth";
import { authService } from "@/services/auth-service";
import { FormError } from "./form-error";

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: authService.login,
    onSuccess: async ({ user }) => {
      queryClient.setQueryData(["auth", "me"], user);
      toast.success("Đăng nhập thành công");
      router.replace("/dashboard");
    },
  });
  const error = mutation.error instanceof ApiError ? mutation.error.message : mutation.error ? "Không thể kết nối máy chủ" : null;

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
      <FormError message={error} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" inputMode="email" autoComplete="email" placeholder="ban@example.com" {...form.register("email")} aria-invalid={Boolean(form.formState.errors.email)} />
        {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Mật khẩu</Label>
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">Quên mật khẩu?</Link>
        </div>
        <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} aria-invalid={Boolean(form.formState.errors.password)} />
        {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
      </div>
      <Button className="w-full" size="lg" disabled={mutation.isPending}>
        {mutation.isPending ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Chưa có tài khoản? <Link href="/register" className="font-medium text-primary hover:underline">Đăng ký</Link>
      </p>
    </form>
  );
}
