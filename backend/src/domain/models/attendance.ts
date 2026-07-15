import type { AttendanceCalculation } from "../services/attendance-calculator.js";

export type AttendanceStatus =
  | "not_started"
  | "working"
  | "on_break"
  | "completed"
  | "leave"
  | "holiday"
  | "day_off"
  | "absent";

export interface BreakSessionDto {
  id: string;
  breakType: "lunch" | "short_break" | "personal" | "outside" | "other";
  startedAt: string;
  endedAt: string | null;
  note: string | null;
}

export interface AttendanceSessionDto {
  id: string;
  shiftId: string | null;
  checkInAt: string;
  checkOutAt: string | null;
  checkInSource: string;
  checkOutSource: string | null;
  note: string | null;
  breaks: BreakSessionDto[];
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
  sessions: AttendanceSessionDto[];
  activeSession: AttendanceSessionDto | null;
  activeBreak: BreakSessionDto | null;
  totals: AttendanceCalculation;
  flags: string[];
}
