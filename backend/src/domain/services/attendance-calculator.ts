export interface TimeRange {
  start: Date;
  end: Date | null;
}

export interface AttendanceCalculationInput {
  sessions: TimeRange[];
  breaks: TimeRange[];
  requiredMinutes: number;
  roundingMinutes: 0 | 5 | 10 | 15;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  overtimeAfterMinutes: number;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  now?: Date;
}

export interface AttendanceCalculation {
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

function durationMinutes(range: TimeRange, now: Date): number {
  const end = range.end ?? now;
  return Math.max(0, Math.round((end.getTime() - range.start.getTime()) / 60_000));
}

export function roundMinutes(value: number, interval: 0 | 5 | 10 | 15): number {
  if (interval === 0) return value;
  return Math.max(0, Math.round(value / interval) * interval);
}

export function calculateAttendance(input: AttendanceCalculationInput): AttendanceCalculation {
  const now = input.now ?? new Date();
  const grossWorkMinutes = input.sessions.reduce((total, range) => total + durationMinutes(range, now), 0);
  const breakMinutes = input.breaks.reduce((total, range) => total + durationMinutes(range, now), 0);
  const netWorkMinutes = Math.max(0, grossWorkMinutes - breakMinutes);
  const roundedWorkMinutes = roundMinutes(netWorkMinutes, input.roundingMinutes);
  const firstCheckIn = input.sessions.length
    ? new Date(Math.min(...input.sessions.map((session) => session.start.getTime())))
    : null;
  const completedEnds = input.sessions.flatMap((session) => (session.end ? [session.end] : []));
  const lastCheckOut = completedEnds.length
    ? new Date(Math.max(...completedEnds.map((date) => date.getTime())))
    : null;

  const lateMinutes = firstCheckIn && input.scheduledStart
    ? Math.max(
        0,
        Math.round((firstCheckIn.getTime() - input.scheduledStart.getTime()) / 60_000) -
          input.lateGraceMinutes,
      )
    : 0;
  const hasActiveSession = input.sessions.some((session) => !session.end);
  const earlyLeaveMinutes = !hasActiveSession && lastCheckOut && input.scheduledEnd
    ? Math.max(
        0,
        Math.round((input.scheduledEnd.getTime() - lastCheckOut.getTime()) / 60_000) -
          input.earlyLeaveGraceMinutes,
      )
    : 0;

  return {
    grossWorkMinutes,
    breakMinutes,
    netWorkMinutes,
    roundedWorkMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    missingMinutes: Math.max(0, input.requiredMinutes - roundedWorkMinutes),
    extraMinutes: Math.max(0, roundedWorkMinutes - input.requiredMinutes),
    overtimeMinutes: Math.max(0, roundedWorkMinutes - input.overtimeAfterMinutes),
  };
}
