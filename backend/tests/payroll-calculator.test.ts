import { describe, expect, it } from "vitest";
import { calculatePayroll } from "../src/domain/services/payroll-calculator.js";

describe("calculatePayroll", () => {
  it("calculates prorated monthly salary, overtime and adjustments", () => {
    const result = calculatePayroll({
      salaryType: "monthly", baseSalary: "17600000", hourlyRate: null, dailyRate: null,
      standardWorkDays: "22", actualWorkMinutes: 10080, standardWorkMinutes: 10560,
      overtime: [{ minutes: 120, multiplier: "1.5" }], allowances: ["500000"],
      bonuses: ["100000"], deductions: ["200000"],
    });
    expect(result.effectiveHourlyRate).toBe("100000.00");
    expect(result.overtimeAmount).toBe("300000.00");
    expect(Number(result.netAmount)).toBeGreaterThan(16_000_000);
  });

  it("uses exact hourly rate without floating values in the contract", () => {
    const result = calculatePayroll({
      salaryType: "hourly", baseSalary: "0", hourlyRate: "50000", dailyRate: null,
      standardWorkDays: "22", actualWorkMinutes: 600, standardWorkMinutes: 0,
      overtime: [], allowances: [], bonuses: [], deductions: [],
    });
    expect(result.netAmount).toBe("500000.00");
  });
});
