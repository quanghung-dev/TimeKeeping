import { apiRequest } from "@/lib/api/client";
import type { AttendanceSnapshot } from "@/types/attendance";
import type { OfflineAction } from "@/lib/offline/db";

function requestBody(extra: Record<string, unknown> = {}) {
  return {
    clientRequestId: crypto.randomUUID(),
    source: "web" as const,
    ...extra,
  };
}

export const attendanceService = {
  today: () => apiRequest<AttendanceSnapshot>("/attendance/today"),
  byDate: (date: string) => apiRequest<AttendanceSnapshot>(`/attendance/days/${date}`),
  createSession: (body: { checkInAt: string; checkOutAt: string | null; note: string | null }) => apiRequest<AttendanceSnapshot>("/attendance/sessions", { method: "POST", body }),
  updateSession: (id: string, body: { checkInAt: string; checkOutAt: string | null; note: string | null }) => apiRequest<AttendanceSnapshot>(`/attendance/sessions/${id}`, { method: "PUT", body }),
  deleteSession: (id: string) => apiRequest<void>(`/attendance/sessions/${id}`, { method: "DELETE" }),
  cancelLatest: () => apiRequest<AttendanceSnapshot>("/attendance/cancel-latest", { method: "POST" }),
  resolveForgotten: (checkOutAt: string, note: string | null) => apiRequest<AttendanceSnapshot>("/attendance/resolve-forgotten-checkout", { method: "POST", body: { clientRequestId: crypto.randomUUID(), checkOutAt, note } }),
  checkIn: () =>
    apiRequest<AttendanceSnapshot>("/attendance/check-in", {
      method: "POST",
      body: requestBody(),
    }),
  checkOut: () =>
    apiRequest<AttendanceSnapshot>("/attendance/check-out", {
      method: "POST",
      body: requestBody(),
    }),
  startBreak: () =>
    apiRequest<AttendanceSnapshot>("/breaks/start", {
      method: "POST",
      body: requestBody({ breakType: "personal" }),
    }),
  endBreak: () =>
    apiRequest<AttendanceSnapshot>("/breaks/end", {
      method: "POST",
      body: requestBody(),
    }),
  sendQueued: (action: OfflineAction) => {
    const paths = {
      "check-in": "/attendance/check-in",
      "check-out": "/attendance/check-out",
      "break-start": "/breaks/start",
      "break-end": "/breaks/end",
    } as const;
    return apiRequest<AttendanceSnapshot>(paths[action.type], {
      method: "POST",
      body: {
        ...action.payload,
        clientRequestId: action.clientRequestId,
        source: "offline",
        localTimestamp: action.localTimestamp,
      },
    });
  },
};
