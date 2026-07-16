import { describe, expect, it } from "vitest";
import { validateCheckInWindow } from "../src/application/services/attendance-service.js";
import { AppError } from "../src/common/errors/app-error.js";
import type { AttendanceContextRow } from "../src/infrastructure/repositories/attendance-repository.js";

const context = {
  check_in_window_start_at: new Date("2026-07-15T23:00:00.000Z"),
  check_in_window_end_at: new Date("2026-07-16T11:00:00.000Z"),
} as AttendanceContextRow;

describe("check-in window", () => {
  it.each([
    ["06:00", "2026-07-15T23:00:00.000Z"],
    ["12:00", "2026-07-16T05:00:00.000Z"],
    ["18:00", "2026-07-16T11:00:00.000Z"],
  ])("allows check-in at %s local time", (_label, timestamp) => {
    expect(() => validateCheckInWindow(context, new Date(timestamp))).not.toThrow();
  });

  it("rejects a check-in before 06:00 local time", () => {
    expectCheckInError("2026-07-15T22:59:59.999Z", "CHECK_IN_TOO_EARLY");
  });

  it("rejects a check-in after 18:00 local time", () => {
    expectCheckInError("2026-07-16T11:00:00.001Z", "CHECK_IN_TOO_LATE");
  });
});

function expectCheckInError(timestamp: string, code: string): void {
  try {
    validateCheckInWindow(context, new Date(timestamp));
    expect.fail("Expected check-in validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
  }
}
