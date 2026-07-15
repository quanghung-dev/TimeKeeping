"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, Save } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api/client";
import { disablePushNotifications, enablePushNotifications } from "@/lib/pwa/push-notifications";
import { notificationService } from "@/services/notification-service";
import type { NotificationSettings as Settings } from "@/types/notification";

const rows: [keyof Settings, string, string][] = [
  ["checkInReminder", "Nhắc chấm vào", "Theo giờ bắt đầu trong lịch làm việc"],
  ["checkOutReminder", "Nhắc chấm ra", "Khi sắp hết giờ nhưng phiên vẫn đang chạy"],
  ["breakReminder", "Nhắc nghỉ giải lao", "Cảnh báo khi thời gian nghỉ kéo dài"],
  ["missingTimeReminder", "Nhắc thiếu giờ", "Khi tổng giờ trong ngày chưa đạt mục tiêu"],
  ["dailySummary", "Tổng kết cuối ngày", "Hiển thị tóm tắt giờ làm trong ứng dụng"],
  ["weeklySummary", "Tổng kết cuối tuần", "Thống kê tiến độ mỗi tuần"],
];

export function NotificationSettings() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["notification-settings"], queryFn: notificationService.settings });
  const save = useMutation({
    mutationFn: notificationService.save,
    onSuccess: (data) => { client.setQueryData(["notification-settings"], data); toast.success("Đã lưu cài đặt nhắc nhở"); },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Không thể lưu"),
  });

  async function update(key: keyof Settings, value: boolean) {
    try {
      if (key === "browserEnabled") {
        if (value) {
          const result = await enablePushNotifications();
          toast.success(result === "subscribed" ? "Đã bật push notification" : "Đã bật thông báo cục bộ; cần VAPID key để nhận push nền");
        } else await disablePushNotifications();
      }
      if (query.data) client.setQueryData(["notification-settings"], { ...query.data, [key]: value });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể thay đổi quyền thông báo");
    }
  }

  return (
    <main className="mx-auto min-h-svh w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-center gap-3"><Button asChild variant="ghost" size="icon"><Link href="/dashboard"><ArrowLeft /></Link></Button><div><h1 className="text-xl font-semibold">Thông báo</h1><p className="text-sm text-muted-foreground">Chọn thời điểm bạn muốn được nhắc</p></div></header>
      {query.isPending ? <Skeleton className="h-96" /> : query.isError || !query.data ? <Card><CardContent className="py-12 text-center text-destructive"><p>Không tải được cài đặt.</p><Button className="mt-4" variant="outline" onClick={() => query.refetch()}>Thử lại</Button></CardContent></Card> : <>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="text-primary" /> Nhắc nhở</CardTitle><CardDescription>Các nhắc nhở dựa trên lịch và phiên hiện tại.</CardDescription></CardHeader><CardContent className="divide-y">{rows.map(([key, title, description]) => <Setting key={key} title={title} description={description} checked={query.data[key]} onChange={(value) => void update(key, value)} />)}</CardContent></Card>
        <Card className="mt-4"><CardHeader><CardTitle>Kênh thông báo</CardTitle></CardHeader><CardContent className="divide-y"><Setting title="Thông báo trình duyệt" description="Chỉ hỏi quyền khi bạn chủ động bật; push nền cần VAPID key" checked={query.data.browserEnabled} onChange={(value) => void update("browserEnabled", value)} /><Setting title="Email" description="Cần cấu hình nhà cung cấp email ở backend" checked={query.data.emailEnabled} onChange={(value) => void update("emailEnabled", value)} /></CardContent></Card>
        <Button className="mt-4" size="lg" disabled={save.isPending} onClick={() => save.mutate(query.data)}><Save /> {save.isPending ? "Đang lưu…" : "Lưu cài đặt"}</Button>
      </>}
    </main>
  );
}

function Setting({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 py-4"><div><p className="font-medium">{title}</p><p className="text-sm text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={onChange} /></div>;
}
