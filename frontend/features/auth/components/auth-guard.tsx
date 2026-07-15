"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { authService } from "@/services/auth-service";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authService.me,
    retry: false,
  });
  const unauthorized = query.error instanceof ApiError && query.error.status === 401;

  useEffect(() => {
    if (unauthorized) router.replace("/login");
  }, [router, unauthorized]);

  if (query.isPending || unauthorized) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-5 px-4 py-8">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (query.isError) {
    return (
      <main className="grid min-h-svh place-items-center px-4">
        <Alert className="max-w-md" variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Không tải được dữ liệu</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Máy chủ hiện không phản hồi. Dữ liệu của bạn không bị thay đổi.</p>
            <Button variant="outline" onClick={() => query.refetch()}>Thử lại</Button>
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  return children;
}
