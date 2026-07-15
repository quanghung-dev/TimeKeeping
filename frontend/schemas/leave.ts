import { z } from "zod";

export const leaveSchema = z
  .object({
    leaveDate: z.string().min(1, "Hãy chọn ngày nghỉ"),
    leaveType: z.enum(["paid_leave", "unpaid_leave", "sick_leave", "personal_leave", "other"]),
    leavePeriod: z.enum(["full_day", "morning", "afternoon", "hourly"]),
    durationMinutes: z.number().int().min(1).max(1440).nullable(),
    reason: z.string().max(2000, "Lý do tối đa 2.000 ký tự"),
  })
  .superRefine((value, context) => {
    if (value.leavePeriod === "hourly" && !value.durationMinutes) {
      context.addIssue({ code: "custom", path: ["durationMinutes"], message: "Hãy nhập số phút nghỉ" });
    }
  });

export type LeaveFormValues = z.infer<typeof leaveSchema>;
