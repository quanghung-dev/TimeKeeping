"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  BriefcaseBusiness,
  BookOpen,
  Bell,
  Settings,
  CalendarDays,
  CalendarClock,
  Clock3,
  ClockPlus,
  History,
  Coffee,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  Umbrella,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { queueOfflineAction, type OfflineActionType } from "@/lib/offline/db";
import { optimisticAttendanceSnapshot } from "@/lib/attendance/optimistic";
import { attendanceService } from "@/services/attendance-service";
import { authService } from "@/services/auth-service";
import type { AttendanceStatus } from "@/types/attendance";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  not_started: "Chưa chấm công",
  working: "Đang làm việc",
  on_break: "Đang nghỉ",
  completed: "Đã hoàn thành",
  leave: "Nghỉ phép",
  holiday: "Ngày lễ",
  day_off: "Ngày nghỉ",
  absent: "Vắng mặt",
};

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}g ${minutes.toString().padStart(2, "0")}p`;
}

function formatTime(value: string | null, timezone: string): string {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(value));
}

function useClock(timezone: string | undefined) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return useMemo(() => {
    if (!timezone) return { time: "--:--:--", date: "" };
    return {
      time: new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: timezone,
      }).format(now),
      date: new Intl.DateTimeFormat("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: timezone,
      }).format(now),
    };
  }, [now, timezone]);
}

export function DashboardFoundation() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const { data: user } = useQuery({ queryKey: ["auth", "me"], queryFn: authService.me });
  const attendance = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: attendanceService.today,
    refetchInterval: 60_000,
  });
  const clock = useClock(attendance.data?.timezone ?? user?.timezone);

  const logout = useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      queryClient.clear();
      toast.success("Đã đăng xuất");
      router.replace("/login");
    },
  });

  const mutateAttendance = useMutation({
    mutationFn: async (action: "check-in" | "check-out" | "break-start" | "break-end") => {
      if (!navigator.onLine) {
        if (!attendance.data) throw new Error("Chưa có dữ liệu hôm nay để ghi nhận ngoại tuyến");
        const queued = await queueOfflineAction(action as OfflineActionType, action === "break-start" ? { breakType: "personal" } : {});
        return { snapshot: optimisticAttendanceSnapshot(attendance.data, action, queued.localTimestamp, queued.clientRequestId), queued: true };
      }
      const snapshot = action === "check-in" ? await attendanceService.checkIn()
        : action === "check-out" ? await attendanceService.checkOut()
        : action === "break-start" ? await attendanceService.startBreak()
        : await attendanceService.endBreak();
      return { snapshot, queued: false };
    },
    onSuccess: ({ snapshot, queued }, action) => {
      queryClient.setQueryData(["attendance", "today"], snapshot);
      const messages = {
        "check-in": "Đã chấm vào",
        "check-out": "Đã chấm ra",
        "break-start": "Đã bắt đầu nghỉ",
        "break-end": "Đã quay lại làm việc",
      };
      toast.success(queued ? "Đã lưu ngoại tuyến, sẽ đồng bộ khi có mạng" : messages[action]);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Không thể cập nhật chấm công");
    },
  });

  if (!user) return null;
  const snapshot = attendance.data;
  const progress = snapshot?.schedule.requiredMinutes
    ? Math.min(100, Math.round((snapshot.totals.roundedWorkMinutes / snapshot.schedule.requiredMinutes) * 100))
    : 0;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-7">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-11"><AvatarFallback>{initials(user.displayName)}</AvatarFallback></Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">Xin chào,</p>
            <h1 className="truncate font-semibold">{user.displayName}</h1>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon"><Link href="/notifications" aria-label="Thông báo"><Bell className="size-5" /></Link></Button>
          <Button variant="ghost" size="icon" aria-label="Tải lại" onClick={() => attendance.refetch()} disabled={attendance.isFetching}>
            <RefreshCw className={attendance.isFetching ? "size-5 animate-spin" : "size-5"} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Đổi giao diện" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            {resolvedTheme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
        </div>
      </header>

      <section className="mt-7 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/12 via-card to-card">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <Badge variant={snapshot?.status === "working" ? "default" : "secondary"}>
                {snapshot ? STATUS_LABELS[snapshot.status] : "Đang tải"}
              </Badge>
              <Clock3 className="size-5 text-primary" />
            </div>
            <CardTitle className="pt-4 text-4xl font-semibold tabular-nums sm:text-5xl">{clock.time}</CardTitle>
            <CardDescription className="capitalize">{clock.date} · {snapshot?.timezone ?? user.timezone}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {attendance.isPending ? (
              <Skeleton className="h-10 w-full" />
            ) : attendance.isError ? (
              <p className="text-sm text-destructive">Không tải được trạng thái chấm công. Hãy kiểm tra kết nối và thử lại.</p>
            ) : snapshot ? (
              <div className="flex flex-wrap gap-2">
                {!snapshot.activeSession && (
                  <Button size="lg" onClick={() => mutateAttendance.mutate("check-in")} disabled={mutateAttendance.isPending}>
                    <LogIn /> Chấm vào
                  </Button>
                )}
                {snapshot.activeSession && !snapshot.activeBreak && (
                  <Button size="lg" variant="secondary" onClick={() => mutateAttendance.mutate("break-start")} disabled={mutateAttendance.isPending}>
                    <Coffee /> Bắt đầu nghỉ
                  </Button>
                )}
                {snapshot.activeBreak && (
                  <Button size="lg" onClick={() => mutateAttendance.mutate("break-end")} disabled={mutateAttendance.isPending}>
                    <BriefcaseBusiness /> Tiếp tục làm
                  </Button>
                )}
                {snapshot.activeSession && (
                  <Button size="lg" variant="destructive" onClick={() => mutateAttendance.mutate("check-out")} disabled={mutateAttendance.isPending || Boolean(snapshot.activeBreak)}>
                    <LogOut /> Chấm ra
                  </Button>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tiến độ hôm nay</CardTitle>
            <CardDescription>
              Lịch {formatTime(snapshot?.schedule.startAt ?? null, snapshot?.timezone ?? user.timezone)} – {formatTime(snapshot?.schedule.endAt ?? null, snapshot?.timezone ?? user.timezone)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>Đã làm {formatMinutes(snapshot?.totals.roundedWorkMinutes ?? 0)}</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Giờ vào" value={formatTime(snapshot?.sessions[0]?.checkInAt ?? null, snapshot?.timezone ?? user.timezone)} />
              <Metric label="Nghỉ" value={formatMinutes(snapshot?.totals.breakMinutes ?? 0)} />
              <Metric label="Còn thiếu" value={formatMinutes(snapshot?.totals.missingMinutes ?? 0)} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Dòng thời gian</CardTitle><CardDescription>Các phiên làm việc và nghỉ trong ngày</CardDescription></CardHeader>
          <CardContent>
            {!snapshot?.sessions.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Chưa có hoạt động nào hôm nay.</p>
            ) : (
              <div className="space-y-4">
                {snapshot.sessions.map((session, index) => (
                  <div key={session.id} className="border-l-2 border-primary/30 pl-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">Phiên làm việc {index + 1}</p>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatTime(session.checkInAt, snapshot.timezone)} – {formatTime(session.checkOutAt, snapshot.timezone)}
                      </span>
                    </div>
                    {session.breaks.map((item) => (
                      <div key={item.id} className="mt-2 flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                        <span className="flex items-center gap-2"><Coffee className="size-4" /> Nghỉ giải lao</span>
                        <span className="tabular-nums text-muted-foreground">{formatTime(item.startedAt, snapshot.timezone)} – {formatTime(item.endedAt, snapshot.timezone)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Truy cập nhanh</CardTitle><CardDescription>{user.email}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {snapshot?.flags.map((flag) => <Badge key={flag} variant="outline"><AlarmClock /> {flag.replaceAll("_", " ")}</Badge>)}
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="secondary"><Link href="/attendance/history"><History /> Lịch sử</Link></Button>
              <Button asChild variant="secondary"><Link href="/calendar"><CalendarDays /> Lịch</Link></Button>
              <Button asChild variant="secondary"><Link href="/leaves"><Umbrella /> Nghỉ phép</Link></Button>
              <Button asChild variant="secondary"><Link href="/overtime"><ClockPlus /> Làm thêm</Link></Button>
              <Button asChild variant="secondary"><Link href="/settings/profile"><Settings /> Hồ sơ</Link></Button>
              <Button asChild variant="secondary"><Link href="/settings/work-schedule"><CalendarClock /> Lịch làm</Link></Button>
              <Button asChild variant="secondary"><Link href="/journal"><BookOpen /> Nhật ký</Link></Button>
            </div>
            <Button variant="outline" className="w-full" disabled={logout.isPending} onClick={() => logout.mutate()}>
              <LogOut /> {logout.isPending ? "Đang đăng xuất…" : "Đăng xuất"}
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/70 px-2 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
