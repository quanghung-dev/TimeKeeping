import { z } from "zod";

export const leaveInputSchema = z
  .object({
    leaveDate: z.iso.date(),
    leaveType: z.enum(["paid_leave", "unpaid_leave", "sick_leave", "personal_leave", "other"]),
    leavePeriod: z.enum(["full_day", "morning", "afternoon", "hourly"]),
    durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
    reason: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.leavePeriod === "hourly" && !value.durationMinutes) {
      context.addIssue({ code: "custom", path: ["durationMinutes"], message: "Nghi theo gio can so phut" });
    }
  });

export const leaveIdSchema = z.object({ id: z.uuid() });
export const leaveListQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200).default(new Date().getUTCFullYear()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const leaveSummaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200).default(new Date().getUTCFullYear()),
});

export type LeaveInput = z.infer<typeof leaveInputSchema>;
export type LeaveListQuery = z.infer<typeof leaveListQuerySchema>;
