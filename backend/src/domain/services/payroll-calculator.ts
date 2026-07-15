export interface PayrollCalculationInput {
  salaryType: "monthly" | "hourly" | "daily";
  baseSalary: string;
  hourlyRate: string | null;
  dailyRate: string | null;
  standardWorkDays: string;
  actualWorkMinutes: number;
  standardWorkMinutes: number;
  overtime: Array<{ minutes: number; multiplier: string }>;
  allowances: string[];
  bonuses: string[];
  deductions: string[];
}

export interface PayrollCalculation {
  regularAmount: string;
  overtimeAmount: string;
  allowanceAmount: string;
  bonusAmount: string;
  deductionAmount: string;
  grossAmount: string;
  netAmount: string;
  effectiveHourlyRate: string;
}

function money(value: number): string { return Math.max(0, value).toFixed(2); }
function sum(values: string[]): number { return values.reduce((total, value) => total + Number(value), 0); }

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculation {
  const standardDays = Math.max(1, Number(input.standardWorkDays));
  const hourlyRate = input.salaryType === "hourly"
    ? Number(input.hourlyRate ?? 0)
    : input.salaryType === "daily"
      ? Number(input.dailyRate ?? 0) / 8
      : Number(input.baseSalary) / standardDays / 8;
  const regularAmount = input.salaryType === "monthly"
    ? input.standardWorkMinutes > 0
      ? Number(input.baseSalary) * Math.min(1, input.actualWorkMinutes / input.standardWorkMinutes)
      : 0
    : input.actualWorkMinutes / 60 * hourlyRate;
  const overtimeAmount = input.overtime.reduce(
    (total, entry) => total + entry.minutes / 60 * hourlyRate * Number(entry.multiplier),
    0,
  );
  const allowanceAmount = sum(input.allowances);
  const bonusAmount = sum(input.bonuses);
  const deductionAmount = sum(input.deductions);
  const grossAmount = regularAmount + overtimeAmount + allowanceAmount + bonusAmount;
  return {
    regularAmount: money(regularAmount), overtimeAmount: money(overtimeAmount),
    allowanceAmount: money(allowanceAmount), bonusAmount: money(bonusAmount),
    deductionAmount: money(deductionAmount), grossAmount: money(grossAmount),
    netAmount: money(grossAmount - deductionAmount), effectiveHourlyRate: money(hourlyRate),
  };
}
