export type AttendanceStatus =
  | "not_started"
  | "working"
  | "on_break"
  | "completed"
  | "leave"
  | "holiday"
  | "day_off"
  | "absent";

export interface BreakSession {
  id: string;
  breakType: "lunch" | "short_break" | "personal" | "outside" | "other";
  startedAt: string;
  endedAt: string | null;
  note: string | null;
}

export interface AttendanceSession {
  id: string;
  shiftId: string | null;
  checkInAt: string;
  checkOutAt: string | null;
  checkInSource: string;
  checkOutSource: string | null;
  note: string | null;
  breaks: BreakSession[];
}

export interface AttendanceTotals {
  grossWorkMinutes: number;
  breakMinutes: number;
  netWorkMinutes: number;
  roundedWorkMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  missingMinutes: number;
  extraMinutes: number;
  overtimeMinutes: number;
}

export interface AttendanceSnapshot {
  workDate: string;
  timezone: string;
  status: AttendanceStatus;
  schedule: {
    id: string | null;
    isWorkingDay: boolean;
    startAt: string | null;
    endAt: string | null;
    requiredMinutes: number;
  };
  sessions: AttendanceSession[];
  activeSession: AttendanceSession | null;
  activeBreak: BreakSession | null;
  totals: AttendanceTotals;
  flags: string[];
}
