"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Save, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { settingsService, type ProfilePayload } from "@/services/settings-service";
import type { ProfileSettings as Profile } from "@/types/settings";

export function ProfileSettings() {
  const query = useQuery({ queryKey: ["profile"], queryFn: settingsService.profile });

  return (
    <main className="mx-auto min-h-svh w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link href="/dashboard"><ArrowLeft /></Link></Button>
        <div><h1 className="text-xl font-semibold">Hồ sơ cá nhân</h1><p className="text-sm text-muted-foreground">Thông tin và định dạng hiển thị</p></div>
      </header>
      {query.isPending ? <Skeleton className="h-96" /> : query.isError || !query.data ? (
        <Card><CardContent className="py-12 text-center text-destructive">Không tải được hồ sơ.</CardContent></Card>
      ) : <ProfileForm initial={query.data} />}
    </main>
  );
}

function ProfileForm({ initial }: { initial: Profile }) {
  const client = useQueryClient();
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [data, setData] = useState<ProfilePayload>(() => ({
    displayName: initial.displayName,
    company: initial.company,
    jobTitle: initial.jobTitle,
    timezone: initial.timezone,
    timeFormat: initial.timeFormat,
    language: initial.language,
    weekStartsOn: initial.weekStartsOn,
    currency: initial.currency,
    themeMode: initial.themeMode,
    accentColor: initial.accentColor,
  }));
  const save = useMutation({
    mutationFn: () => settingsService.saveProfile(data),
    onSuccess: (profile) => {
      client.setQueryData(["profile"], profile);
      client.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Đã lưu hồ sơ");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Không thể lưu"),
  });
  const uploadAvatar = useMutation({
    mutationFn: settingsService.avatar,
    onSuccess: async () => {
      setAvatarVersion(Date.now());
      await client.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Đã cập nhật ảnh đại diện");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Không thể tải ảnh lên"),
  });

  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!(["image/jpeg", "image/png", "image/webp"].includes(file.type)) || file.size > 2 * 1024 * 1024) {
      toast.error("Chọn ảnh JPEG, PNG hoặc WebP không quá 2 MB");
      return;
    }
    uploadAvatar.mutate(file);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserRound className="text-primary" /> Thông tin</CardTitle>
        <CardDescription>{initial.email}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 sm:col-span-2">
          <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted text-muted-foreground">
            {initial.hasAvatar ? <Image unoptimized fill className="object-cover" src={`/api/profile/avatar?v=${avatarVersion}`} alt="Ảnh đại diện" /> : <UserRound className="size-9" />}
          </div>
          <div className="space-y-1">
            <Button asChild variant="outline" disabled={uploadAvatar.isPending}>
              <Label className="cursor-pointer"><Camera /> {uploadAvatar.isPending ? "Đang tải…" : "Đổi ảnh"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectAvatar} /></Label>
            </Button>
            <p className="text-xs text-muted-foreground">JPEG, PNG hoặc WebP; tối đa 2 MB.</p>
          </div>
        </div>
        <Field label="Tên hiển thị"><Input value={data.displayName} onChange={(event) => setData({ ...data, displayName: event.target.value })} /></Field>
        <Field label="Công ty"><Input value={data.company ?? ""} onChange={(event) => setData({ ...data, company: event.target.value || null })} /></Field>
        <Field label="Chức vụ"><Input value={data.jobTitle ?? ""} onChange={(event) => setData({ ...data, jobTitle: event.target.value || null })} /></Field>
        <Field label="Múi giờ"><Input value={data.timezone} onChange={(event) => setData({ ...data, timezone: event.target.value })} /></Field>
        <Field label="Định dạng giờ">
          <Select value={data.timeFormat} onValueChange={(value) => setData({ ...data, timeFormat: value as "12h" | "24h" })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="24h">24 giờ</SelectItem><SelectItem value="12h">12 giờ</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Tiền tệ"><Input maxLength={3} value={data.currency} onChange={(event) => setData({ ...data, currency: event.target.value.toUpperCase() })} /></Field>
        <Field label="Giao diện">
          <Select value={data.themeMode} onValueChange={(value) => setData({ ...data, themeMode: value as ProfilePayload["themeMode"] })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="system">Theo hệ thống</SelectItem><SelectItem value="light">Sáng</SelectItem><SelectItem value="dark">Tối</SelectItem></SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2"><Button disabled={save.isPending || data.displayName.trim().length < 2 || data.currency.length !== 3} onClick={() => save.mutate()}><Save /> {save.isPending ? "Đang lưu…" : "Lưu hồ sơ"}</Button></div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
