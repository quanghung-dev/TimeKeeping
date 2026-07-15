import { leaveInputSchema } from "../src/application/validators/leave-schemas.js";

const body = {
  leaveDate: "2026-07-15",
  leaveType: "paid_leave",
  leavePeriod: "full_day",
  durationMinutes: null,
  reason: null
};

const result = leaveInputSchema.safeParse(body);
console.log("Validation Result:", result.success ? "Success" : result.error);
