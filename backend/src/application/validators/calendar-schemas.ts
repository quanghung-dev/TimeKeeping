import { z } from "zod";

export const calendarRangeSchema = z
  .object({ start: z.iso.date(), end: z.iso.date() })
  .refine((value) => value.end >= value.start, { path: ["end"], message: "Ngay ket thuc phai tu ngay bat dau" });

export const calendarEventSchema = z
  .object({
    title: z.string().trim().min(1).max(150),
    eventType: z.enum(["work", "remote", "business_trip", "day_off", "custom"]),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    isAllDay: z.boolean().default(false),
    note: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    path: ["endsAt"],
    message: "Gio ket thuc phai sau gio bat dau",
  });

export const calendarEventIdSchema = z.object({ id: z.uuid() });
export const copyWeekSchema = z.object({ weekStart: z.iso.date() });
export const recurringEventSchema = calendarEventSchema.and(
  z.object({
    weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    untilDate: z.iso.date(),
  }),
);

export type CalendarRange = z.infer<typeof calendarRangeSchema>;
export type CalendarEventInput = z.infer<typeof calendarEventSchema>;
export type RecurringEventInput = z.infer<typeof recurringEventSchema>;
