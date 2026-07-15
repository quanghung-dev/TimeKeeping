"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { vi } from "date-fns/locale";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/client";
import { calendarService } from "@/services/calendar-service";
import type { CalendarItem } from "@/types/calendar";

type View = "day" | "week" | "month";
const EVENT_LABELS = { work: "Làm việc", remote: "Làm tại nhà", business_trip: "Công tác", day_off: "Ngày nghỉ", custom: "Khác" } as const;

function inputDateTime(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function itemClass(item: CalendarItem): string {
  if (item.itemType === "leave") return "bg-status-leave/15 text-status-leave";
  if (item.itemType === "holiday" || item.itemType === "day_off") return "bg-muted text-muted-foreground";
  if (item.itemType === "remote") return "bg-status-remote/15 text-status-remote";
  if (item.itemType === "attendance" && ["completed"].includes(item.status ?? "")) return "bg-status-success/15 text-status-success";
  if (item.itemType === "attendance") return "bg-status-working/15 text-status-working";
  return "bg-primary/10 text-primary";
}

export function CalendarManager() {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<keyof typeof EVENT_LABELS>("work");
  const [startsAt, setStartsAt] = useState(() => inputDateTime(new Date()));
  const [endsAt, setEndsAt] = useState(() => inputDateTime(new Date(Date.now() + 60 * 60_000)));
  const queryClient = useQueryClient();
  const range = useMemo(() => {
    if (view === "day") return { start: cursor, end: cursor };
    if (view === "week") return { start: startOfWeek(cursor, { weekStartsOn: 1 }), end: endOfWeek(cursor, { weekStartsOn: 1 }) };
    return { start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) };
  }, [cursor, view]);
  const start = format(range.start, "yyyy-MM-dd");
  const end = format(range.end, "yyyy-MM-dd");
  const items = useQuery({ queryKey: ["calendar", start, end], queryFn: () => calendarService.list(start, end) });
  const create = useMutation({
    mutationFn: () => calendarService.create({ title, eventType, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), isAllDay: false, note: null }),
    onSuccess: async () => { toast.success("Đã thêm sự kiện"); setTitle(""); setShowForm(false); await queryClient.invalidateQueries({ queryKey: ["calendar"] }); },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Không thể thêm sự kiện"),
  });
  const remove = useMutation({
    mutationFn: calendarService.remove,
    onSuccess: async () => { toast.success("Đã xoá sự kiện"); await queryClient.invalidateQueries({ queryKey: ["calendar"] }); },
  });
  const gridDays = useMemo(() => {
    const result: Date[] = [];
    for (let day = range.start; day <= range.end; day = addDays(day, 1)) result.push(day);
    return result;
  }, [range]);
  const selectedItems = items.data?.filter((item) => isSameDay(new Date(item.startsAt), selected)) ?? [];

  return (
    <main className="mx-auto min-h-svh w-full max-w-6xl px-3 py-5 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Button asChild variant="ghost" size="icon"><Link href="/dashboard" aria-label="Về tổng quan"><ArrowLeft /></Link></Button><div><h1 className="text-xl font-semibold">Lịch</h1><p className="text-sm text-muted-foreground">Công, nghỉ và sự kiện cá nhân</p></div></div>
        <Button onClick={() => setShowForm((value) => !value)}><Plus /> Thêm sự kiện</Button>
      </header>

      {showForm && <Card className="mt-4"><CardHeader><CardTitle>Sự kiện mới</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><div className="space-y-2 lg:col-span-2"><Label htmlFor="title">Tiêu đề</Label><Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} /></div><div className="space-y-2"><Label>Loại</Label><Select value={eventType} onValueChange={(value) => setEventType(value as keyof typeof EVENT_LABELS)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EVENT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="startsAt">Bắt đầu</Label><Input id="startsAt" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="endsAt">Kết thúc</Label><Input id="endsAt" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></div><div className="sm:col-span-2 lg:col-span-5"><Button disabled={!title.trim() || create.isPending || !startsAt || !endsAt} onClick={() => create.mutate()}>{create.isPending ? "Đang lưu…" : "Lưu sự kiện"}</Button></div></CardContent></Card>}

      <Card className="mt-4">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => setCursor(subMonths(cursor, 1))}><ChevronLeft /></Button><CardTitle className="min-w-44 text-center capitalize">{format(cursor, "MMMM yyyy", { locale: vi })}</CardTitle><Button variant="ghost" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight /></Button></div><Tabs value={view} onValueChange={(value) => setView(value as View)}><TabsList><TabsTrigger value="day">Ngày</TabsTrigger><TabsTrigger value="week">Tuần</TabsTrigger><TabsTrigger value="month">Tháng</TabsTrigger></TabsList></Tabs></div>
          <CardDescription>Chọn một ngày để xem chi tiết bên dưới.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.isPending ? <Skeleton className="h-96 w-full" /> : items.isError ? <div className="py-16 text-center text-sm text-destructive">Không tải được lịch. <Button variant="link" onClick={() => items.refetch()}>Thử lại</Button></div> : <><div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => <div key={label} className="py-2">{label}</div>)}</div><div className="grid grid-cols-7 overflow-hidden rounded-xl border">{gridDays.map((day) => { const dayItems = items.data?.filter((item) => isSameDay(new Date(item.startsAt), day)) ?? []; return <button key={day.toISOString()} className={`min-h-20 border-b border-r p-1 text-left transition-colors hover:bg-muted/60 sm:min-h-28 sm:p-2 ${!isSameMonth(day, cursor) && view === "month" ? "bg-muted/30 text-muted-foreground" : ""} ${isSameDay(day, selected) ? "ring-2 ring-inset ring-primary" : ""}`} onClick={() => setSelected(day)}><span className="text-xs font-medium sm:text-sm">{format(day, "d")}</span><div className="mt-1 space-y-1">{dayItems.slice(0, 2).map((item) => <div key={`${item.itemType}-${item.id}`} className={`truncate rounded px-1 py-0.5 text-[10px] sm:text-xs ${itemClass(item)}`}>{item.title}</div>)}{dayItems.length > 2 && <p className="text-[10px] text-muted-foreground">+{dayItems.length - 2}</p>}</div></button>; })}</div></>}
        </CardContent>
      </Card>

      <Card className="mt-4"><CardHeader><CardTitle className="capitalize">{format(selected, "EEEE, dd/MM/yyyy", { locale: vi })}</CardTitle><CardDescription>{selectedItems.length} mục</CardDescription></CardHeader><CardContent>{selectedItems.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Không có hoạt động trong ngày.</p> : <div className="space-y-2">{selectedItems.map((item) => <div key={`${item.itemType}-${item.id}`} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><div className="flex items-center gap-2"><Badge variant="outline">{item.itemType}</Badge><p className="truncate font-medium">{item.title}</p></div><p className="mt-1 text-sm text-muted-foreground">{item.isAllDay ? "Cả ngày" : `${format(new Date(item.startsAt), "HH:mm")} – ${format(new Date(item.endsAt), "HH:mm")}`}{item.actualMinutes !== null ? ` · ${item.actualMinutes} phút` : ""}</p></div>{["work", "remote", "business_trip", "day_off", "custom"].includes(item.itemType) && <Button variant="ghost" size="icon" aria-label="Xoá sự kiện" onClick={() => { if (window.confirm("Xoá sự kiện này?")) remove.mutate(item.id); }}><Trash2 className="text-destructive" /></Button>}</div>)}</div>}</CardContent></Card>
    </main>
  );
}
