"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Coins, Plus, Save, WalletCards } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { payrollService, type PayrollAdjustmentPayload, type PayrollSettingsPayload } from "@/services/payroll-service";
import type { PayrollSettings } from "@/types/payroll";

function money(value: string | undefined, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

export function PayrollDashboard() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [year, monthNumber] = month.split("-").map(Number);
  const client = useQueryClient();
  const settings = useQuery({ queryKey: ["payroll", "settings"], queryFn: payrollService.settings });
  const estimate = useQuery({ queryKey: ["payroll", "estimate", year, monthNumber], queryFn: () => payrollService.estimate(year!, monthNumber!), enabled: Boolean(settings.data), retry: false });
  const snapshot = useMutation({
    mutationFn: () => payrollService.snapshot(year!, monthNumber!),
    onSuccess: () => toast.success("Đã lưu ảnh chụp bảng lương"),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Không thể lưu"),
  });

  return (
    <main className="mx-auto min-h-svh w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Button asChild variant="ghost" size="icon"><Link href="/dashboard"><ArrowLeft /></Link></Button><div><h1 className="text-xl font-semibold">Lương cá nhân</h1><p className="text-sm text-muted-foreground">Ước tính từ dữ liệu chấm công</p></div></div>
        <Input className="w-40" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </header>
      {settings.isPending ? <Skeleton className="h-52" /> : <>
        <SettingsForm initial={settings.data ?? null} onSaved={() => client.invalidateQueries({ queryKey: ["payroll"] })} />
        {settings.data && <section className="mt-4">
          {estimate.isPending ? <Skeleton className="h-64" /> : estimate.isError ? <Card><CardContent className="py-12 text-center text-destructive">Không thể tính lương kỳ này.</CardContent></Card> : estimate.data && <>
            <div className="grid gap-3 sm:grid-cols-3"><Amount label="Lương thường" value={estimate.data.calculation.regularAmount} currency={estimate.data.currency} /><Amount label="Tiền làm thêm" value={estimate.data.calculation.overtimeAmount} currency={estimate.data.currency} /><Amount label="Thực nhận tạm tính" value={estimate.data.calculation.netAmount} currency={estimate.data.currency} primary /></div>
            <Card className="mt-4"><CardHeader><CardTitle>Chi tiết ước tính</CardTitle><CardDescription>Dựa trên {Math.round(estimate.data.attendance.actualMinutes / 60)} giờ làm đã ghi nhận.</CardDescription></CardHeader><CardContent className="space-y-3"><Row label="Tổng trước khấu trừ" value={money(estimate.data.calculation.grossAmount, estimate.data.currency)} /><Row label="Phụ cấp" value={money(estimate.data.calculation.allowanceAmount, estimate.data.currency)} /><Row label="Thưởng" value={money(estimate.data.calculation.bonusAmount, estimate.data.currency)} /><Row label="Khấu trừ" value={`-${money(estimate.data.calculation.deductionAmount, estimate.data.currency)}`} />{estimate.data.adjustments.length > 0 && <div className="space-y-2 border-t pt-3"><p className="text-sm font-medium">Điều chỉnh trong kỳ</p>{estimate.data.adjustments.map((item) => <Row key={item.id} label={`${item.category} · ${item.adjustmentDate}`} value={money(item.amount, estimate.data.currency)} />)}</div>}<div className="pt-2"><Button onClick={() => snapshot.mutate()} disabled={snapshot.isPending}><Save /> Lưu bảng lương tháng</Button></div></CardContent></Card>
            <AdjustmentForm key={month} month={month} onSaved={() => client.invalidateQueries({ queryKey: ["payroll", "estimate", year, monthNumber] })} />
          </>}
        </section>}
      </>}
    </main>
  );
}

function SettingsForm({ initial, onSaved }: { initial: PayrollSettings | null; onSaved: () => void }) {
  const [data, setData] = useState<PayrollSettingsPayload>(() => initial ? { salaryType: initial.salaryType, baseSalary: initial.baseSalary, hourlyRate: initial.hourlyRate, dailyRate: initial.dailyRate, weekdayOvertimeMultiplier: initial.weekdayOvertimeMultiplier, weekendOvertimeMultiplier: initial.weekendOvertimeMultiplier, holidayOvertimeMultiplier: initial.holidayOvertimeMultiplier, effectiveFrom: initial.effectiveFrom } : { salaryType: "monthly", baseSalary: "0", hourlyRate: null, dailyRate: null, weekdayOvertimeMultiplier: "1.5", weekendOvertimeMultiplier: "2", holidayOvertimeMultiplier: "3", effectiveFrom: new Date().toISOString().slice(0, 10) });
  const save = useMutation({ mutationFn: () => payrollService.saveSettings(data), onSuccess: () => { toast.success("Đã lưu cấu hình lương"); onSaved(); }, onError: (error) => toast.error(error instanceof ApiError ? error.message : "Cấu hình chưa hợp lệ") });
  const rate = data.salaryType === "hourly" ? data.hourlyRate ?? "" : data.salaryType === "daily" ? data.dailyRate ?? "" : data.baseSalary;
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="text-primary" /> Cấu hình lương</CardTitle><CardDescription>Thiết lập mức lương và hệ số làm thêm áp dụng.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Hình thức</Label><Select value={data.salaryType} onValueChange={(value) => setData({ ...data, salaryType: value as PayrollSettingsPayload["salaryType"] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Theo tháng</SelectItem><SelectItem value="hourly">Theo giờ</SelectItem><SelectItem value="daily">Theo ngày</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Mức lương</Label><Input type="number" min="0" value={rate} onChange={(event) => setData(data.salaryType === "hourly" ? { ...data, hourlyRate: event.target.value } : data.salaryType === "daily" ? { ...data, dailyRate: event.target.value } : { ...data, baseSalary: event.target.value })} /></div><div className="space-y-2"><Label>Áp dụng từ</Label><Input type="date" value={data.effectiveFrom} onChange={(event) => setData({ ...data, effectiveFrom: event.target.value })} /></div><div className="sm:col-span-3"><Button disabled={save.isPending || !rate || Number(rate) < 0} onClick={() => save.mutate()}>{save.isPending ? "Đang lưu…" : "Lưu cấu hình"}</Button></div></CardContent></Card>;
}

function AdjustmentForm({ month, onSaved }: { month: string; onSaved: () => void }) {
  const [data, setData] = useState<PayrollAdjustmentPayload>({ adjustmentDate: `${month}-01`, adjustmentType: "allowance", category: "", amount: "", note: null });
  const save = useMutation({ mutationFn: () => payrollService.adjustment(data), onSuccess: () => { toast.success("Đã thêm điều chỉnh lương"); setData((current) => ({ ...current, category: "", amount: "", note: null })); onSaved(); }, onError: (error) => toast.error(error instanceof ApiError ? error.message : "Không thể thêm điều chỉnh") });
  return <Card className="mt-4"><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="text-primary" /> Thêm điều chỉnh</CardTitle><CardDescription>Phụ cấp, thưởng hoặc khoản khấu trừ sẽ được tính vào đúng kỳ.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="space-y-2"><Label>Loại</Label><Select value={data.adjustmentType} onValueChange={(value) => setData({ ...data, adjustmentType: value as PayrollAdjustmentPayload["adjustmentType"] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="allowance">Phụ cấp</SelectItem><SelectItem value="bonus">Thưởng</SelectItem><SelectItem value="deduction">Khấu trừ</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Ngày</Label><Input type="date" value={data.adjustmentDate} onChange={(event) => setData({ ...data, adjustmentDate: event.target.value })} /></div><div className="space-y-2"><Label>Danh mục</Label><Input maxLength={50} placeholder="Ăn trưa, hiệu suất…" value={data.category} onChange={(event) => setData({ ...data, category: event.target.value })} /></div><div className="space-y-2"><Label>Số tiền</Label><Input type="number" min="0" step="0.01" value={data.amount} onChange={(event) => setData({ ...data, amount: event.target.value })} /></div><div className="space-y-2 sm:col-span-2 lg:col-span-3"><Label>Ghi chú</Label><Input maxLength={1000} value={data.note ?? ""} onChange={(event) => setData({ ...data, note: event.target.value || null })} /></div><div className="flex items-end"><Button className="w-full" disabled={save.isPending || !data.category.trim() || !data.amount || Number(data.amount) <= 0} onClick={() => save.mutate()}><Plus /> {save.isPending ? "Đang thêm…" : "Thêm điều chỉnh"}</Button></div></CardContent></Card>;
}

function Amount({ label, value, currency, primary = false }: { label: string; value: string; currency: string; primary?: boolean }) { return <Card className={primary ? "border-primary/30 bg-primary/5" : ""}><CardContent><Coins className={primary ? "mb-3 text-primary" : "mb-3 text-muted-foreground"} /><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{money(value, currency)}</p></CardContent></Card>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between border-b pb-3 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>; }
