import { describe, expect, it } from "vitest";
import { calculateAttendance, roundMinutes } from "../src/domain/services/attendance-calculator.js";

const at = (hour: number, minute = 0, day = 1) => new Date(Date.UTC(2026, 6, day, hour, minute));

describe("attendance calculator", () => {
  it("subtracts breaks across multiple sessions", () => {
    const result = calculateAttendance({
      sessions: [
        { start: at(8), end: at(12) },
        { start: at(13), end: at(17, 30) },
      ],
      breaks: [
        { start: at(10), end: at(10, 15) },
        { start: at(15), end: at(15, 10) },
      ],
      requiredMinutes: 480,
      roundingMinutes: 0,
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
      overtimeAfterMinutes: 480,
      scheduledStart: at(8),
      scheduledEnd: at(17),
    });
    expect(result).toMatchObject({
      grossWorkMinutes: 510,
      breakMinutes: 25,
      netWorkMinutes: 485,
      extraMinutes: 5,
      overtimeMinutes: 5,
      missingMinutes: 0,
    });
  });

  it("calculates late and early leave after grace periods", () => {
    const result = calculateAttendance({
      sessions: [{ start: at(8, 17), end: at(16, 40) }],
      breaks: [],
      requiredMinutes: 480,
      roundingMinutes: 0,
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
      overtimeAfterMinutes: 480,
      scheduledStart: at(8),
      scheduledEnd: at(17),
    });
    expect(result.lateMinutes).toBe(12);
    expect(result.earlyLeaveMinutes).toBe(15);
  });

  it("uses now for an open cross-midnight session", () => {
    const result = calculateAttendance({
      sessions: [{ start: at(22, 0, 1), end: null }],
      breaks: [{ start: at(23, 30, 1), end: at(23, 45, 1) }],
      requiredMinutes: 240,
      roundingMinutes: 0,
      lateGraceMinutes: 0,
      earlyLeaveGraceMinutes: 0,
      overtimeAfterMinutes: 240,
      scheduledStart: at(22, 0, 1),
      scheduledEnd: at(2, 0, 2),
      now: at(2, 0, 2),
    });
    expect(result.grossWorkMinutes).toBe(240);
    expect(result.netWorkMinutes).toBe(225);
    expect(result.missingMinutes).toBe(15);
  });

  it("rounds payable duration without changing raw durations", () => {
    expect(roundMinutes(482, 5)).toBe(480);
    expect(roundMinutes(483, 5)).toBe(485);
    expect(roundMinutes(487, 15)).toBe(480);
    expect(roundMinutes(0, 0)).toBe(0);
  });

  it("BUS-001 Case 1: Một session đã kết thúc và một session đang hoạt động", () => {
    const result = calculateAttendance({
      sessions: [
        { start: at(8), end: at(12) },
        { start: at(13), end: null },
      ],
      breaks: [],
      requiredMinutes: 480,
      roundingMinutes: 0,
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
      overtimeAfterMinutes: 480,
      scheduledStart: at(8),
      scheduledEnd: at(17),
      now: at(14),
    });
    expect(result.earlyLeaveMinutes).toBe(0);
  });

  it("BUS-001 Case 2: Tất cả session đã kết thúc, check-out trước giờ quy định", () => {
    const result = calculateAttendance({
      sessions: [
        { start: at(8), end: at(12) },
        { start: at(13), end: at(16, 40) },
      ],
      breaks: [],
      requiredMinutes: 480,
      roundingMinutes: 0,
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
      overtimeAfterMinutes: 480,
      scheduledStart: at(8),
      scheduledEnd: at(17),
    });
    expect(result.earlyLeaveMinutes).toBe(15); // (17:00 - 16:40) - 5 grace = 15
  });

  it("BUS-001 Case 3: Check-out đúng giờ", () => {
    const result = calculateAttendance({
      sessions: [{ start: at(8), end: at(17) }],
      breaks: [],
      requiredMinutes: 480,
      roundingMinutes: 0,
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
      overtimeAfterMinutes: 480,
      scheduledStart: at(8),
      scheduledEnd: at(17),
    });
    expect(result.earlyLeaveMinutes).toBe(0);
  });

  it("BUS-001 Case 4: Check-out sau giờ quy định", () => {
    const result = calculateAttendance({
      sessions: [{ start: at(8), end: at(17, 30) }],
      breaks: [],
      requiredMinutes: 480,
      roundingMinutes: 0,
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
      overtimeAfterMinutes: 480,
      scheduledStart: at(8),
      scheduledEnd: at(17),
    });
    expect(result.earlyLeaveMinutes).toBe(0);
  });

  it("BUS-001 Case 5: Chỉ có một session đang hoạt động", () => {
    const result = calculateAttendance({
      sessions: [{ start: at(8), end: null }],
      breaks: [],
      requiredMinutes: 480,
      roundingMinutes: 0,
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
      overtimeAfterMinutes: 480,
      scheduledStart: at(8),
      scheduledEnd: at(17),
      now: at(12),
    });
    expect(result.earlyLeaveMinutes).toBe(0);
  });

  it("BUS-001 Case 6: Nhiều session, session cuối cùng là thời gian check-out muộn nhất", () => {
    const result = calculateAttendance({
      sessions: [
        { start: at(8), end: at(11) },
        { start: at(12), end: at(17, 5) },
      ],
      breaks: [],
      requiredMinutes: 480,
      roundingMinutes: 0,
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
      overtimeAfterMinutes: 480,
      scheduledStart: at(8),
      scheduledEnd: at(17),
    });
    expect(result.earlyLeaveMinutes).toBe(0);
  });

  it("BUS-001 Case 7: Session có dữ liệu không theo đúng thứ tự thời gian đầu vào", () => {
    const result = calculateAttendance({
      sessions: [
        { start: at(13), end: at(16, 30) },
        { start: at(8), end: at(12) },
      ],
      breaks: [],
      requiredMinutes: 480,
      roundingMinutes: 0,
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
      overtimeAfterMinutes: 480,
      scheduledStart: at(8),
      scheduledEnd: at(17),
    });
    expect(result.earlyLeaveMinutes).toBe(25); // (17:00 - 16:30) - 5 grace = 25
  });
});
