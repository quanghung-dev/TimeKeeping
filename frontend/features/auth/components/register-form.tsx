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
import { registerSchema, type RegisterFormValues } from "@/schemas/auth";
import { authService } from "@/services/auth-service";
import { FormError } from "./form-error";

export function RegisterForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", email: "", password: "", confirmPassword: "" },
  });
  const mutation = useMutation({
    mutationFn: (values: RegisterFormValues) =>
      authService.register({
        displayName: values.displayName,
        email: values.email,
        password: values.password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh",
      }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(["auth", "me"], user);
      toast.success("Tài khoản đã được tạo");
      router.replace("/dashboard");
    },
  });
  const error = mutation.error instanceof ApiError ? mutation.error.message : mutation.error ? "Không thể kết nối máy chủ" : null;

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
      <FormError message={error} />
      <div className="space-y-2">
        <Label htmlFor="displayName">Tên hiển thị</Label>
        <Input id="displayName" autoComplete="name" placeholder="Nguyễn Văn A" {...form.register("displayName")} aria-invalid={Boolean(form.formState.errors.displayName)} />
        {form.formState.errors.displayName && <p className="text-sm text-destructive">{form.formState.errors.displayName.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" inputMode="email" autoComplete="email" placeholder="ban@example.com" {...form.register("email")} aria-invalid={Boolean(form.formState.errors.email)} />
        {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">Mật khẩu</Label>
          <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} aria-invalid={Boolean(form.formState.errors.password)} />
          {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Xác nhận</Label>
          <Input id="confirmPassword" type="password" autoComplete="new-password" {...form.register("confirmPassword")} aria-invalid={Boolean(form.formState.errors.confirmPassword)} />
          {form.formState.errors.confirmPassword && <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>}
        </div>
      </div>
      <Button className="w-full" size="lg" disabled={mutation.isPending}>
        {mutation.isPending ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Đã có tài khoản? <Link href="/login" className="font-medium text-primary hover:underline">Đăng nhập</Link>
      </p>
    </form>
  );
}
