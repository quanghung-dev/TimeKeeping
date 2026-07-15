"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileArchive, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { dataService } from "@/services/data-service";

function firstDay() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`; }

export function DataSettings() {
  const client = useQueryClient();
  const [start, setStart] = useState(firstDay);
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [format, setFormat] = useState("xlsx");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const backup = useMutation({ mutationFn: dataService.downloadBackup, onError: (error) => toast.error(error instanceof Error ? error.message : "Không thể sao lưu") });
  const restore = useMutation({
    mutationFn: async (file: File) => { if (file.size > 1_000_000) throw new Error("File sao lưu tối đa 1 MB"); return dataService.restore(JSON.parse(await file.text()) as unknown); },
    onSuccess: () => { client.invalidateQueries(); toast.success("Đã khôi phục và hợp nhất dữ liệu"); },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Không thể khôi phục"),
  });
  const remove = useMutation({
    mutationFn: () => dataService.deletePersonalData(password, confirmation),
    onSuccess: () => { client.clear(); toast.success("Đã xoá dữ liệu và khởi tạo lại cài đặt mặc định"); window.location.assign("/dashboard"); },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Không thể xoá dữ liệu"),
  });

  return <main className="mx-auto min-h-svh w-full max-w-3xl px-4 py-6 sm:px-6">
    <header className="mb-6 flex items-center gap-3"><Button asChild variant="ghost" size="icon"><Link href="/dashboard"><ArrowLeft /></Link></Button><div><h1 className="text-xl font-semibold">Dữ liệu</h1><p className="text-sm text-muted-foreground">Xuất báo cáo, sao lưu và khôi phục</p></div></header>
    <div className="space-y-4">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Download className="text-primary" /> Xuất báo cáo</CardTitle><CardDescription>CSV, Excel hoặc PDF theo khoảng ngày.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><Field label="Từ ngày"><Input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></Field><Field label="Đến ngày"><Input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></Field><Field label="Định dạng"><Select value={format} onValueChange={setFormat}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="xlsx">Excel (.xlsx)</SelectItem><SelectItem value="csv">CSV</SelectItem><SelectItem value="pdf">PDF</SelectItem></SelectContent></Select></Field><div className="sm:col-span-3"><Button disabled={end < start} onClick={() => dataService.downloadReport(start, end, format)}><Download /> Tải báo cáo</Button></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileArchive className="text-primary" /> Sao lưu JSON</CardTitle><CardDescription>Bản sao không chứa mật khẩu, refresh token hay secret.</CardDescription></CardHeader><CardContent><Button variant="secondary" disabled={backup.isPending} onClick={() => backup.mutate()}><Download /> {backup.isPending ? "Đang chuẩn bị…" : "Tải bản sao lưu"}</Button></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Upload className="text-primary" /> Khôi phục</CardTitle><CardDescription>Dữ liệu được hợp nhất theo ID; hệ thống không xoá dữ liệu hiện có.</CardDescription></CardHeader><CardContent><Label htmlFor="backupFile" className="mb-2">Chọn file JSON tối đa 1 MB</Label><Input id="backupFile" type="file" accept="application/json,.json" disabled={restore.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file && confirm("Khôi phục và hợp nhất dữ liệu từ file này?")) restore.mutate(file); }} /></CardContent></Card>
      <Card className="border-destructive/40"><CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><Trash2 /> Xoá toàn bộ dữ liệu cá nhân</CardTitle><CardDescription>Tài khoản và email vẫn được giữ lại. Chấm công, lịch, task, báo cáo, lương và cài đặt sẽ bị xoá vĩnh viễn.</CardDescription></CardHeader><CardContent className="space-y-4"><Field label="Mật khẩu hiện tại"><Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field><Field label={'Nhập chính xác "XOA DU LIEU" để xác nhận'}><Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></Field><Button variant="destructive" disabled={remove.isPending || !password || confirmation !== "XOA DU LIEU"} onClick={() => { if (confirm("Bạn chắc chắn muốn xoá vĩnh viễn toàn bộ dữ liệu cá nhân?")) remove.mutate(); }}><Trash2 /> {remove.isPending ? "Đang xoá…" : "Xoá dữ liệu"}</Button></CardContent></Card>
    </div>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
