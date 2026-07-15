import { getPool } from "../../infrastructure/database/pool.js";
import { NotificationRepository } from "../../infrastructure/repositories/notification-repository.js";
import type { NotificationSettingsInput, PushSubscriptionInput } from "../validators/notification-schemas.js";

function settings(row: Record<string, boolean>) {
  return { checkInReminder: row.check_in_reminder, checkOutReminder: row.check_out_reminder, breakReminder: row.break_reminder, missingTimeReminder: row.missing_time_reminder, dailySummary: row.daily_summary, weeklySummary: row.weekly_summary, browserEnabled: row.browser_enabled, emailEnabled: row.email_enabled };
}

export class NotificationService {
  static async settings(userId: string) {
    const row = await NotificationRepository.settings(getPool(), userId) as Record<string, boolean> | null;
    return row ? settings(row) : { checkInReminder: true, checkOutReminder: true, breakReminder: true, missingTimeReminder: true, dailySummary: true, weeklySummary: true, browserEnabled: false, emailEnabled: false };
  }
  static async save(userId: string, input: NotificationSettingsInput) { return settings(await NotificationRepository.save(getPool(), userId, input) as Record<string, boolean>); }
  static async list(userId: string, page: number, pageSize: number) {
    const result = await NotificationRepository.list(getPool(), userId, page, pageSize);
    return { items: result.rows.map((row: Record<string, unknown>) => ({ id: row.id, notificationType: row.notification_type, title: row.title, body: row.body, readAt: row.read_at instanceof Date ? row.read_at.toISOString() : null, createdAt: (row.created_at as Date).toISOString() })), page, pageSize, total: result.total };
  }
  static async read(userId: string, ids: string[]) { return { updated: await NotificationRepository.read(getPool(), userId, ids) }; }
  static async subscribe(userId: string, input: PushSubscriptionInput) { await NotificationRepository.subscribe(getPool(), userId, input); return { subscribed: true }; }
  static async unsubscribe(userId: string, endpoint: string) { return { unsubscribed: await NotificationRepository.unsubscribe(getPool(), userId, endpoint) }; }
  static async generate() { return { created: await NotificationRepository.generateReminders(getPool()) }; }
}
