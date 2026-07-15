import { z } from "zod";

export const overtimeInputSchema = z.object({
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }),
  overtimeType: z.enum(["weekday", "weekend", "holiday"]),
  multiplier: z.union([z.literal(1.5), z.literal(2), z.literal(3)]),
  note: z.string().trim().max(1000).nullable().optional(),
}).refine((value) => new Date(value.endedAt) > new Date(value.startedAt), { path: ["endedAt"], message: "Gio ket thuc phai sau gio bat dau" });

export const overtimeStartSchema = z.object({
  clientRequestId: z.uuid(), overtimeType: z.enum(["weekday", "weekend", "holiday"]),
  multiplier: z.union([z.literal(1.5), z.literal(2), z.literal(3)]), note: z.string().trim().max(1000).nullable().optional(),
});
export const overtimeEndSchema = z.object({ clientRequestId: z.uuid(), note: z.string().trim().max(1000).nullable().optional() });
export const overtimeIdSchema = z.object({ id: z.uuid() });
export const overtimeQuerySchema = z.object({ start: z.iso.date(), end: z.iso.date() });
export type OvertimeInput = z.infer<typeof overtimeInputSchema>;
