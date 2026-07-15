import { apiRequest } from "@/lib/api/client";

export const dataService = {
  restore: (data: unknown) => apiRequest<{ restored: boolean }>("/data/restore", { method: "POST", body: data }),
  deletePersonalData: (password: string, confirmation: string) => apiRequest<{ deleted: boolean }>("/account/data", { method: "DELETE", body: { password, confirmation } }),
  downloadBackup: async () => {
    const response = await fetch("/api/data/backup", { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error("Không thể tạo bản sao lưu");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `timekeeping-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  downloadReport: (start: string, end: string, format: string) => { window.location.href = `/api/exports/report?start=${start}&end=${end}&format=${format}`; },
};
