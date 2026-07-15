import type { Pool } from "pg";
import type { NotificationSettingsInput } from "../../application/validators/notification-schemas.js";
import type { PushSubscriptionInput } from "../../application/validators/notification-schemas.js";

export class NotificationRepository {
  static async settings(db: Pool, userId: string) {
    return (await db.query(`SELECT check_in_reminder,check_out_reminder,break_reminder,missing_time_reminder,daily_summary,weekly_summary,browser_enabled,email_enabled FROM notification_settings WHERE user_id=$1`, [userId])).rows[0] ?? null;
  }
  static async save(db: Pool, userId: string, i: NotificationSettingsInput) {
    return (await db.query(`INSERT INTO notification_settings(user_id,check_in_reminder,check_out_reminder,break_reminder,missing_time_reminder,daily_summary,weekly_summary,browser_enabled,email_enabled)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)ON CONFLICT(user_id)DO UPDATE SET check_in_reminder=EXCLUDED.check_in_reminder,check_out_reminder=EXCLUDED.check_out_reminder,break_reminder=EXCLUDED.break_reminder,missing_time_reminder=EXCLUDED.missing_time_reminder,daily_summary=EXCLUDED.daily_summary,weekly_summary=EXCLUDED.weekly_summary,browser_enabled=EXCLUDED.browser_enabled,email_enabled=EXCLUDED.email_enabled,updated_at=NOW()RETURNING check_in_reminder,check_out_reminder,break_reminder,missing_time_reminder,daily_summary,weekly_summary,browser_enabled,email_enabled`, [userId, i.checkInReminder, i.checkOutReminder, i.breakReminder, i.missingTimeReminder, i.dailySummary, i.weeklySummary, i.browserEnabled, i.emailEnabled])).rows[0]!;
  }
  static async list(db: Pool, userId: string, page: number, pageSize: number) {
    const result = await db.query(`SELECT id,notification_type,title,body,read_at,created_at,COUNT(*)OVER()::text total_count FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [userId, pageSize, (page - 1) * pageSize]);
    return { rows: result.rows, total: Number(result.rows[0]?.total_count ?? 0) };
  }
  static async read(db: Pool, userId: string, ids: string[]) {
    return (await db.query(`UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=$1 AND id=ANY($2::uuid[])`, [userId, ids])).rowCount ?? 0;
  }
  static async subscribe(db: Pool, userId: string, input: PushSubscriptionInput): Promise<void> {
    await db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [userId, input.endpoint, input.keys.p256dh, input.keys.auth],
    );
  }
  static async unsubscribe(db: Pool, userId: string, endpoint: string): Promise<boolean> {
    const result = await db.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [userId, endpoint],
    );
    return (result.rowCount ?? 0) > 0;
  }
  static async generateReminders(db: Pool): Promise<number> {
    const result = await db.query(`WITH candidates AS(
      SELECT d.user_id,'forgotten_checkout'::text notification_type,'Quen cham ra'::text title,'Phien lam viec da vuot qua thoi gian toi da.'::text body
      FROM attendance_sessions s JOIN attendance_days d ON d.id=s.attendance_day_id JOIN user_settings us ON us.user_id=d.user_id LEFT JOIN notification_settings ns ON ns.user_id=d.user_id
      WHERE s.check_out_at IS NULL AND NOW()-s.check_in_at>(us.max_session_minutes||' minutes')::interval AND COALESCE(ns.check_out_reminder,TRUE)
      UNION ALL
      SELECT d.user_id,'long_break','Nghi qua lau','Phien nghi giai lao da keo dai hon 90 phut.'
      FROM break_sessions b JOIN attendance_sessions s ON s.id=b.attendance_session_id JOIN attendance_days d ON d.id=s.attendance_day_id LEFT JOIN notification_settings ns ON ns.user_id=d.user_id
      WHERE b.ended_at IS NULL AND NOW()-b.started_at>INTERVAL '90 minutes' AND COALESCE(ns.break_reminder,TRUE)
    ) INSERT INTO notifications(user_id,notification_type,title,body)
      SELECT c.user_id,c.notification_type,c.title,c.body FROM candidates c
      WHERE NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=c.user_id AND n.notification_type=c.notification_type AND n.created_at>NOW()-INTERVAL '2 hours')`);
    return result.rowCount ?? 0;
  }
}
