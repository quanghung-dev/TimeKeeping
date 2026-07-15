export type LeaveType = "paid_leave" | "unpaid_leave" | "sick_leave" | "personal_leave" | "other";
export type LeavePeriod = "full_day" | "morning" | "afternoon" | "hourly";

export interface LeaveDay {
  id: string;
  leaveDate: string;
  leaveType: LeaveType;
  leavePeriod: LeavePeriod;
  durationMinutes: number | null;
  reason: string | null;
  createdAt: string;
}

export interface LeaveList {
  items: LeaveDay[];
  page: number;
  pageSize: number;
  total: number;
}

export interface LeaveBalance {
  year: number;
  allowanceMinutes: number;
  carriedMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  leaveCount: number;
}
