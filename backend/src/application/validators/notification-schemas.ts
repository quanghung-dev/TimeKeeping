import { z } from "zod";

export const notificationSettingsSchema = z.object({
  checkInReminder: z.boolean(),
  checkOutReminder: z.boolean(),
  breakReminder: z.boolean(),
  missingTimeReminder: z.boolean(),
  dailySummary: z.boolean(),
  weeklySummary: z.boolean(),
  browserEnabled: z.boolean(),
  emailEnabled: z.boolean(),
});
export const notificationReadSchema = z.object({ ids: z.array(z.uuid()).min(1).max(100) });
export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2048),
  keys: z.object({
    p256dh: z.string().min(16).max(1024),
    auth: z.string().min(8).max(512),
  }),
});
export const pushUnsubscribeSchema = z.object({ endpoint: z.url().max(2048) });

export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
