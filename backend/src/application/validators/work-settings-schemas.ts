import { z } from "zod";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Gio phai co dinh dang HH:mm");

const scheduleSchema = z
  .object({
    dayOfWeek: z.number().int().min(1).max(7),
    isWorkingDay: z.boolean(),
    startTime: timeSchema.nullable(),
    endTime: timeSchema.nullable(),
    standardMinutes: z.number().int().min(0).max(1440),
    defaultBreakMinutes: z.number().int().min(0).max(720),
    shiftIds: z.array(z.uuid()).max(8).default([]),
  })
  .superRefine((value, context) => {
    if (value.isWorkingDay && (!value.startTime || !value.endTime)) {
      context.addIssue({ code: "custom", path: ["startTime"], message: "Ngay lam viec can gio bat dau va ket thuc" });
    }
    if (value.isWorkingDay && value.standardMinutes <= 0) {
      context.addIssue({ code: "custom", path: ["standardMinutes"], message: "So phut tieu chuan phai lon hon 0" });
    }
  });

export const updateWorkSettingsSchema = z
  .object({
    lateGraceMinutes: z.number().int().min(0).max(240),
    earlyLeaveGraceMinutes: z.number().int().min(0).max(240),
    overtimeAfterMinutes: z.number().int().min(0).max(1440),
    roundingMinutes: z.union([z.literal(0), z.literal(5), z.literal(10), z.literal(15)]),
    autoDetectOvertime: z.boolean(),
    autoDeductBreak: z.boolean(),
    scheduleMode: z.enum(["fixed", "flexible", "shift"]),
    earliestCheckInMinutes: z.number().int().min(0).max(720),
    latestCheckInMinutes: z.number().int().min(0).max(720),
    standardWorkDaysPerMonth: z.number().positive().max(31),
    checkoutOpenBreakPolicy: z.enum(["require_end", "auto_end"]),
    maxSessionMinutes: z.number().int().min(60).max(2880),
    overtimeRule: z.enum(["after_daily_threshold", "outside_schedule", "manual_only"]),
    schedules: z.array(scheduleSchema).length(7),
  })
  .superRefine((value, context) => {
    const days = new Set(value.schedules.map((schedule) => schedule.dayOfWeek));
    if (days.size !== 7) {
      context.addIssue({ code: "custom", path: ["schedules"], message: "Lich phai co du 7 ngay khac nhau" });
    }
  });

export const workShiftSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().trim().min(1).max(30),
  startTime: timeSchema,
  endTime: timeSchema,
  standardMinutes: z.number().int().min(1).max(1440),
  defaultBreakMinutes: z.number().int().min(0).max(720),
  isActive: z.boolean(),
});

export const workShiftIdSchema = z.object({ id: z.uuid() });

export type UpdateWorkSettingsInput = z.infer<typeof updateWorkSettingsSchema>;
export type WorkShiftInput = z.infer<typeof workShiftSchema>;
