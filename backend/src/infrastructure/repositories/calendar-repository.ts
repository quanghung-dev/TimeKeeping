import type { Pool, PoolClient } from "pg";
import type { CalendarEventInput, CalendarRange, RecurringEventInput } from "../../application/validators/calendar-schemas.js";

export interface CalendarItemRow {
  id: string;
  item_type: string;
  title: string;
  starts_at: Date;
  ends_at: Date;
  is_all_day: boolean;
  status: string | null;
  actual_minutes: number | null;
}

export interface CalendarEventRow {
  id: string;
  title: string;
  event_type: CalendarEventInput["eventType"];
  starts_at: Date;
  ends_at: Date;
  is_all_day: boolean;
  note: string | null;
}

export class CalendarRepository {
  static async list(db: Pool, userId: string, range: CalendarRange): Promise<CalendarItemRow[]> {
    const result = await db.query<CalendarItemRow>(
      `WITH context AS (
         SELECT timezone, $2::date AS start_date, $3::date AS end_date FROM users WHERE id = $1
       ), bounds AS (
         SELECT start_date AT TIME ZONE timezone AS starts_at,
                (end_date + 1) AT TIME ZONE timezone AS ends_at, timezone
         FROM context
       )
       SELECT ce.id, ce.event_type AS item_type, ce.title, ce.starts_at, ce.ends_at,
              ce.is_all_day, NULL::text AS status, NULL::int AS actual_minutes
       FROM calendar_events ce CROSS JOIN bounds b
       WHERE ce.user_id = $1 AND ce.starts_at < b.ends_at AND ce.ends_at > b.starts_at
       UNION ALL
       SELECT ad.id, 'attendance', 'Cham cong',
              ad.work_date AT TIME ZONE b.timezone,
              (ad.work_date + 1) AT TIME ZONE b.timezone,
              TRUE, ad.status, s.actual_work_minutes
       FROM attendance_days ad CROSS JOIN bounds b
       LEFT JOIN v_daily_attendance_summary s ON s.attendance_day_id = ad.id
       WHERE ad.user_id = $1 AND ad.work_date BETWEEN $2::date AND $3::date
       UNION ALL
       SELECT ld.id, 'leave', COALESCE(ld.reason, 'Nghi phep'),
              ld.leave_date AT TIME ZONE b.timezone,
              (ld.leave_date + 1) AT TIME ZONE b.timezone,
              TRUE, ld.leave_type, ld.duration_minutes
       FROM leave_days ld CROSS JOIN bounds b
       WHERE ld.user_id = $1 AND ld.leave_date BETWEEN $2::date AND $3::date
       UNION ALL
       SELECT h.id, 'holiday', h.name,
              h.holiday_date AT TIME ZONE b.timezone,
              (h.holiday_date + 1) AT TIME ZONE b.timezone,
              TRUE, CASE WHEN h.is_paid THEN 'paid' ELSE 'unpaid' END, NULL::int
       FROM holidays h CROSS JOIN bounds b
       WHERE h.user_id = $1 AND h.holiday_date BETWEEN $2::date AND $3::date
       ORDER BY starts_at, item_type`,
      [userId, range.start, range.end],
    );
    return result.rows;
  }

  static async create(db: Pool | PoolClient, userId: string, input: CalendarEventInput): Promise<CalendarEventRow> {
    const result = await db.query<CalendarEventRow>(
      `INSERT INTO calendar_events (user_id, title, event_type, starts_at, ends_at, is_all_day, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, event_type, starts_at, ends_at, is_all_day, note`,
      [userId, input.title, input.eventType, input.startsAt, input.endsAt, input.isAllDay, input.note ?? null],
    );
    return result.rows[0]!;
  }

  static async update(db: Pool, userId: string, id: string, input: CalendarEventInput): Promise<CalendarEventRow | null> {
    const result = await db.query<CalendarEventRow>(
      `UPDATE calendar_events SET title = $3, event_type = $4, starts_at = $5,
              ends_at = $6, is_all_day = $7, note = $8
       WHERE id = $2 AND user_id = $1
       RETURNING id, title, event_type, starts_at, ends_at, is_all_day, note`,
      [userId, id, input.title, input.eventType, input.startsAt, input.endsAt, input.isAllDay, input.note ?? null],
    );
    return result.rows[0] ?? null;
  }

  static async delete(db: Pool, userId: string, id: string): Promise<boolean> {
    const result = await db.query(`DELETE FROM calendar_events WHERE id = $2 AND user_id = $1`, [userId, id]);
    return result.rowCount === 1;
  }

  static async copyPreviousWeek(db: PoolClient, userId: string, weekStart: string): Promise<number> {
    const result = await db.query(
      `INSERT INTO calendar_events (user_id, title, event_type, starts_at, ends_at, is_all_day, note)
       SELECT ce.user_id, ce.title, ce.event_type, ce.starts_at + INTERVAL '7 days',
              ce.ends_at + INTERVAL '7 days', ce.is_all_day, ce.note
       FROM calendar_events ce JOIN users u ON u.id = ce.user_id
       WHERE ce.user_id = $1
         AND ce.starts_at >= (($2::date - 7) AT TIME ZONE u.timezone)
         AND ce.starts_at < ($2::date AT TIME ZONE u.timezone)`,
      [userId, weekStart],
    );
    return result.rowCount ?? 0;
  }

  static async createRecurring(db: PoolClient, userId: string, input: RecurringEventInput): Promise<number> {
    const result = await db.query(
      `WITH context AS (SELECT timezone FROM users WHERE id = $1),
       template AS (
         SELECT $4::timestamptz AT TIME ZONE timezone AS local_start,
                $5::timestamptz AT TIME ZONE timezone AS local_end, timezone FROM context
       ), dates AS (
         SELECT day::date AS event_date FROM generate_series(
           ($4::timestamptz AT TIME ZONE (SELECT timezone FROM context))::date,
           $9::date, INTERVAL '1 day'
         ) day WHERE EXTRACT(ISODOW FROM day)::int = ANY($8::int[])
       )
       INSERT INTO calendar_events
         (user_id, title, event_type, starts_at, ends_at, is_all_day, recurrence_rule, note)
       SELECT $1, $2, $3,
              (d.event_date + t.local_start::time) AT TIME ZONE t.timezone,
              (d.event_date + t.local_end::time + CASE WHEN t.local_end::time <= t.local_start::time THEN INTERVAL '1 day' ELSE INTERVAL '0 day' END) AT TIME ZONE t.timezone,
              $6, 'weekly:' || array_to_string($8::int[], ','), $7
       FROM dates d CROSS JOIN template t`,
      [userId, input.title, input.eventType, input.startsAt, input.endsAt, input.isAllDay, input.note ?? null, input.weekdays, input.untilDate],
    );
    return result.rowCount ?? 0;
  }
}
