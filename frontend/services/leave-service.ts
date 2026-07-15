import { apiRequest } from "@/lib/api/client";
import type { LeaveFormValues } from "@/schemas/leave";
import type { LeaveBalance, LeaveDay, LeaveList } from "@/types/leave";

export const leaveService = {
  list: (year: number) => apiRequest<LeaveList>(`/leaves?year=${year}&page=1&pageSize=100`),
  balance: (year: number) => apiRequest<LeaveBalance>(`/leaves/balance?year=${year}`),
  create: (input: LeaveFormValues) =>
    apiRequest<LeaveDay>("/leaves", {
      method: "POST",
      body: {
        ...input,
        durationMinutes: input.leavePeriod === "hourly" ? input.durationMinutes : null,
        reason: input.reason || null,
      },
    }),
  remove: (id: string) => apiRequest<void>(`/leaves/${id}`, { method: "DELETE" }),
};
