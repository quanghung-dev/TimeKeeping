import { z } from "zod";
export const projectSchema = z.object({ name: z.string().trim().min(1).max(120), color: z.string().trim().min(1).max(30), description: z.string().trim().max(2000).nullable().optional(), isArchived: z.boolean().default(false) });
export const taskSchema = z.object({ projectId: z.uuid().nullable().optional(), title: z.string().trim().min(1).max(200), description: z.string().trim().max(3000).nullable().optional(), taskDate: z.iso.date(), priority: z.enum(["low", "medium", "high"]), estimatedMinutes: z.number().int().min(1).max(10080).nullable().optional() });
export const journalSchema = z.object({ noteDate: z.iso.date(), workSummary: z.string().max(5000).nullable().optional(), nextDayPlan: z.string().max(5000).nullable().optional(), productivityScore: z.number().int().min(1).max(5).nullable().optional() });
export const resourceIdSchema = z.object({ id: z.uuid() });
export const taskQuerySchema = z.object({ date: z.iso.date().optional(), projectId: z.uuid().optional(), status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional() });
export const journalQuerySchema = z.object({ start: z.iso.date(), end: z.iso.date() });
export type ProjectInput = z.infer<typeof projectSchema>; export type TaskInput = z.infer<typeof taskSchema>; export type JournalInput = z.infer<typeof journalSchema>;
