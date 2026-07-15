"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Plus, Trash2, Umbrella } from "lucide-react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { leaveSchema, type LeaveFormValues } from "@/schemas/leave";
import { leaveService } from "@/services/leave-service";
import type { LeavePeriod, LeaveType } from "@/types/leave";

const TYPE_LABELS: Record<LeaveType, string> = {
  paid_leave: "Nghỉ phép có lương",
  unpaid_leave: "Nghỉ không lương",
  sick_leave: "Nghỉ ốm",
  personal_leave: "Nghỉ việc riêng",
  other: "Khác",
};
const PERIOD_LABELS: Record<LeavePeriod, string> = {
  full_day: "Cả ngày",
  morning: "Buổi sáng",
  afternoon: "Buổi chiều",
  hourly: "Theo giờ",
};

function todayInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function LeaveManager() {
  const year = new Date().getFullYear();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["leaves", year], queryFn: () => leaveService.list(year) });
  const balance = useQuery({ queryKey: ["leaves", "balance", year], queryFn: () => leaveService.balance(year) });
  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { leaveDate: todayInput(), leaveType: "paid_leave", leavePeriod: "full_day", durationMinutes: null, reason: "" },
  });
  const create = useMutation({
    mutationFn: leaveService.create,
    onSuccess: async () => {
      toast.success("Đã lưu ngày nghỉ");
      form.reset({ leaveDate: todayInput(), leaveType: "paid_leave", leavePeriod: "full_day", durationMinutes: null, reason: "" });
      await queryClient.invalidateQueries({ queryKey: ["leaves"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Không thể lưu ngày nghỉ"),
  });
  const remove = useMutation({
    mutationFn: leaveService.remove,
    onSuccess: async () => {
      toast.success("Đã xoá ngày nghỉ");
      await queryClient.invalidateQueries({ queryKey: ["leaves"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Không thể xoá ngày nghỉ"),
  });
  const period = useWatch({ control: form.control, name: "leavePeriod" });
  const leaveType = useWatch({ control: form.control, name: "leaveType" });

  return (
    <main className="mx-auto min-h-svh w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link href="/dashboard" aria-label="Về tổng quan"><ArrowLeft /></Link></Button>
        <div><h1 className="text-xl font-semibold">Nghỉ phép</h1><p className="text-sm text-muted-foreground">Quản lý ngày nghỉ cá nhân</p></div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Summary title="Còn lại" value={balance.data ? `${(balance.data.remainingMinutes / 480).toFixed(1)} ngày` : "--"} />
        <Summary title="Đã dùng" value={balance.data ? `${(balance.data.usedMinutes / 480).toFixed(1)} ngày` : "--"} />
        <Summary title={`Số lần năm ${year}`} value={balance.data ? String(balance.data.leaveCount) : "--"} />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="size-4" /> Thêm ngày nghỉ</CardTitle><CardDescription>Dữ liệu sẽ được phản ánh ngay trên ngày công.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => create.mutate(values))} noValidate>
              <div className="space-y-2"><Label htmlFor="leaveDate">Ngày nghỉ</Label><Input id="leaveDate" type="date" {...form.register("leaveDate")} />{form.formState.errors.leaveDate && <p className="text-sm text-destructive">{form.formState.errors.leaveDate.message}</p>}</div>
              <div className="space-y-2"><Label>Loại nghỉ</Label><Select value={leaveType} onValueChange={(value) => form.setValue("leaveType", value as LeaveType)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Thời lượng</Label><Select value={period} onValueChange={(value) => form.setValue("leavePeriod", value as LeavePeriod)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PERIOD_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              {period === "hourly" && <div className="space-y-2"><Label htmlFor="durationMinutes">Số phút</Label><Input id="durationMinutes" type="number" inputMode="numeric" {...form.register("durationMinutes", { setValueAs: (value) => value === "" ? null : Number(value) })} />{form.formState.errors.durationMinutes && <p className="text-sm text-destructive">{form.formState.errors.durationMinutes.message}</p>}</div>}
              <div className="space-y-2"><Label htmlFor="reason">Lý do</Label><Textarea id="reason" placeholder="Không bắt buộc" {...form.register("reason")} /></div>
              <Button className="w-full" size="lg" disabled={create.isPending}>{create.isPending ? "Đang lưu…" : "Lưu ngày nghỉ"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lịch sử năm {year}</CardTitle><CardDescription>{list.data?.total ?? 0} bản ghi</CardDescription></CardHeader>
          <CardContent>
            {list.isPending ? <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : list.isError ? <p className="py-6 text-center text-sm text-destructive">Không tải được danh sách ngày nghỉ.</p> : !list.data?.items.length ? <div className="py-10 text-center text-muted-foreground"><Umbrella className="mx-auto mb-3 size-8" /><p className="text-sm">Chưa có ngày nghỉ nào.</p></div> : <div className="space-y-2">{list.data.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="flex min-w-0 gap-3"><CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="font-medium">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(`${item.leaveDate}T00:00:00`))}</p><p className="truncate text-sm text-muted-foreground">{TYPE_LABELS[item.leaveType]} · {PERIOD_LABELS[item.leavePeriod]}</p></div></div><Button variant="ghost" size="icon" aria-label="Xoá ngày nghỉ" disabled={remove.isPending} onClick={() => { if (window.confirm("Bạn chắc chắn muốn xoá ngày nghỉ này?")) remove.mutate(item.id); }}><Trash2 className="text-destructive" /></Button></div>)}</div>}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Summary({ title, value }: { title: string; value: string }) {
  return <Card size="sm"><CardContent><p className="text-sm text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></CardContent></Card>;
}
