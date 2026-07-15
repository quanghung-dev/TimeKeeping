import { z } from "zod";

const eventBase = z.object({
  clientRequestId: z.uuid(),
  source: z.enum(["web", "mobile", "offline"]).default("web"),
  localTimestamp: z.iso.datetime({ offset: true }).optional(),
  deviceId: z.string().trim().min(1).max(100).optional(),
  note: z.string().trim().max(1000).optional(),
});

function requireOfflineTimestamp(
  value: { source: string; localTimestamp?: string | undefined },
  context: z.RefinementCtx,
) {
  if (value.source === "offline" && !value.localTimestamp) {
    context.addIssue({
      code: "custom",
      path: ["localTimestamp"],
      message: "Su kien offline can thoi gian ghi nhan tren thiet bi",
    });
  }
}

export const checkInSchema = eventBase
  .extend({ shiftId: z.uuid().nullable().optional() })
  .superRefine(requireOfflineTimestamp);

export const checkOutSchema = eventBase.superRefine(requireOfflineTimestamp);

export const breakStartSchema = eventBase
  .extend({
    breakType: z.enum(["lunch", "short_break", "personal", "outside", "other"]).default("personal"),
  })
  .superRefine(requireOfflineTimestamp);

export const breakEndSchema = eventBase.superRefine(requireOfflineTimestamp);

export const attendanceDateSchema = z.object({
  date: z.iso.date(),
});
export const attendanceRangeSchema = z.object({ start: z.iso.date(), end: z.iso.date() });
export const attendanceSessionIdSchema = z.object({ id: z.uuid() });
export const manualSessionSchema = z.object({
  checkInAt: z.iso.datetime({ offset: true }),
  checkOutAt: z.iso.datetime({ offset: true }).nullable(),
  shiftId: z.uuid().nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
}).refine((v) => !v.checkOutAt || new Date(v.checkOutAt) > new Date(v.checkInAt), { path: ["checkOutAt"], message: "Gio ra phai sau gio vao" });
export const forgottenCheckoutSchema = z.object({
  clientRequestId: z.uuid(),
  checkOutAt: z.iso.datetime({ offset: true }),
  note: z.string().trim().max(1000).nullable().optional(),
});
export const breakIdSchema = z.object({ id: z.uuid() });
export const breakUpdateSchema = z.object({
  breakType: z.enum(["lunch", "short_break", "personal", "outside", "other"]),
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }).nullable(),
  note: z.string().trim().max(1000).nullable().optional(),
}).refine(v => !v.endedAt || new Date(v.endedAt) > new Date(v.startedAt), { path: ["endedAt"], message: "Gio ket thuc nghi phai sau gio bat dau" });

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type BreakStartInput = z.infer<typeof breakStartSchema>;
export type BreakEndInput = z.infer<typeof breakEndSchema>;
export type AttendanceEventInput = CheckInInput | CheckOutInput | BreakStartInput | BreakEndInput;
