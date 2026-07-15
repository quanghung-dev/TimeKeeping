import { apiRequest } from "@/lib/api/client";
import type { PayrollEstimate, PayrollSettings } from "@/types/payroll";

export type PayrollSettingsPayload = Omit<PayrollSettings, "id">;
export interface PayrollAdjustmentPayload {
  adjustmentDate: string;
  adjustmentType: "allowance" | "bonus" | "deduction";
  category: string;
  amount: string;
  note?: string | null;
}

export const payrollService = {
  settings: () => apiRequest<PayrollSettings | null>("/payroll/settings"),
  saveSettings: (input: PayrollSettingsPayload) => apiRequest<PayrollSettings>("/payroll/settings", { method: "PUT", body: input }),
  estimate: (year: number, month: number) => apiRequest<PayrollEstimate>(`/payroll/estimate?year=${year}&month=${month}`),
  snapshot: (year: number, month: number) => apiRequest("/payroll/snapshots", { method: "POST", body: { year, month } }),
  history: () => apiRequest<Array<Record<string, string | number>>>("/payroll/history"),
  adjustment: (body: PayrollAdjustmentPayload) => apiRequest("/payroll/allowances", { method: "POST", body }),
};
