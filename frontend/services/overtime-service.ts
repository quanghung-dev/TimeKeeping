import { apiRequest } from "@/lib/api/client";
import type { OvertimeSession, OvertimeSummary } from "@/types/overtime";
const request = () => crypto.randomUUID();
export const overtimeService = {
  list: (start: string, end: string) => apiRequest<OvertimeSession[]>(`/overtime?start=${start}&end=${end}`),
  summary: (start: string, end: string) => apiRequest<OvertimeSummary>(`/overtime/summary?start=${start}&end=${end}`),
  active: () => apiRequest<OvertimeSession | null>("/overtime/active"),
  start: (overtimeType: string, multiplier: number) => apiRequest<OvertimeSession>("/overtime/start", { method: "POST", body: { clientRequestId: request(), overtimeType, multiplier } }),
  end: () => apiRequest<OvertimeSession>("/overtime/end", { method: "POST", body: { clientRequestId: request() } }),
  create: (input: { startedAt: string; endedAt: string; overtimeType: string; multiplier: number; note: string | null }) => apiRequest<OvertimeSession>("/overtime", { method: "POST", body: input }),
  remove: (id: string) => apiRequest<void>(`/overtime/${id}`, { method: "DELETE" }),
};
