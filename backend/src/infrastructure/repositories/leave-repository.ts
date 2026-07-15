import type { Pool, PoolClient } from "pg";
import type { LeaveInput, LeaveListQuery } from "../../application/validators/leave-schemas.js";

export interface LeaveRow {
  id: string;
  leave_date: string;
  leave_type: LeaveInput["leaveType"];
  leave_period: LeaveInput["leavePeriod"];
  duration_minutes: number | null;
  reason: string | null;
  created_at: Date;
}

export class LeaveRepository {
  static async list(db: Pool, userId: string, query: LeaveListQuery): Promise<{ rows: LeaveRow[]; total: number }> {
    const offset = (query.page - 1) * query.pageSize;
    const result = await db.query<LeaveRow & { total_count: string }>(
      `SELECT id, leave_date::text, leave_type, leave_period, duration_minutes, reason, created_at,
              COUNT(*) OVER()::text AS total_count
       FROM leave_days
       WHERE user_id = $1 AND EXTRACT(YEAR FROM leave_date)::int = $2
       ORDER BY leave_date DESC LIMIT $3 OFFSET $4`,
      [userId, query.year, query.pageSize, offset],
    );
    return { rows: result.rows, total: Number(result.rows[0]?.total_count ?? 0) };
  }

  static async find(db: PoolClient, userId: string, id: string): Promise<LeaveRow | null> {
    const result = await db.query<LeaveRow>(
      `SELECT id, leave_date::text, leave_type, leave_period, duration_minutes, reason, created_at
       FROM leave_days WHERE id = $2 AND user_id = $1 FOR UPDATE`,
      [userId, id],
    );
    return result.rows[0] ?? null;
  }

  static async create(db: PoolClient, userId: string, input: LeaveInput): Promise<LeaveRow> {
    const result = await db.query<LeaveRow>(
      `INSERT INTO leave_days (user_id, leave_date, leave_type, leave_period, duration_minutes, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, leave_date::text, leave_type, leave_period, duration_minutes, reason, created_at`,
      [userId, input.leaveDate, input.leaveType, input.leavePeriod, input.durationMinutes ?? null, input.reason ?? null],
    );
    return result.rows[0]!;
  }

  static async update(db: PoolClient, userId: string, id: string, input: LeaveInput): Promise<LeaveRow | null> {
    const result = await db.query<LeaveRow>(
      `UPDATE leave_days SET leave_date = $3, leave_type = $4, leave_period = $5,
              duration_minutes = $6, reason = $7
       WHERE id = $2 AND user_id = $1
       RETURNING id, leave_date::text, leave_type, leave_period, duration_minutes, reason, created_at`,
      [userId, id, input.leaveDate, input.leaveType, input.leavePeriod, input.durationMinutes ?? null, input.reason ?? null],
    );
    return result.rows[0] ?? null;
  }

  static async delete(db: PoolClient, userId: string, id: string): Promise<boolean> {
    const result = await db.query(`DELETE FROM leave_days WHERE id = $2 AND user_id = $1`, [userId, id]);
    return result.rowCount === 1;
  }

  static async syncAttendanceDay(db: PoolClient, userId: string, leaveDate: string): Promise<void> {
    await db.query(
      `INSERT INTO attendance_days (user_id, work_date, schedule_id, status)
       SELECT $1, $2::date, ws.id, 'leave'
       FROM users u
       LEFT JOIN work_schedules ws ON ws.user_id = u.id AND ws.day_of_week = EXTRACT(ISODOW FROM $2::date)::int
       WHERE u.id = $1
       ON CONFLICT (user_id, work_date) DO UPDATE SET status = 'leave'`,
      [userId, leaveDate],
    );
  }

  static async clearAttendanceLeave(db: PoolClient, userId: string, leaveDate: string): Promise<void> {
    await db.query(
      `UPDATE attendance_days d
       SET status = CASE
             WHEN EXISTS (
               SELECT 1 FROM attendance_sessions s WHERE s.attendance_day_id = d.id AND s.check_out_at IS NULL
             ) THEN 'working'
             WHEN EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.attendance_day_id = d.id) THEN 'completed'
             WHEN COALESCE((SELECT ws.is_working_day FROM work_schedules ws WHERE ws.user_id = d.user_id AND ws.day_of_week = EXTRACT(ISODOW FROM d.work_date)::int), FALSE) THEN 'not_started'
             ELSE 'day_off'
           END,
           schedule_id = (SELECT ws.id FROM work_schedules ws WHERE ws.user_id = d.user_id AND ws.day_of_week = EXTRACT(ISODOW FROM d.work_date)::int)
       WHERE d.user_id = $1 AND d.work_date = $2::date AND d.status = 'leave'`,
      [userId, leaveDate],
    );
  }

  static async balance(db: Pool, userId: string, year: number) {
    const result = await db.query<{
      allowance_minutes: number;
      carried_minutes: number;
      used_minutes: number;
      leave_count: number;
    }>(
      `WITH configuration AS (
         SELECT COALESCE(lb.allowance_minutes, 9600) AS allowance_minutes,
                COALESCE(lb.carried_minutes, 0) AS carried_minutes
         FROM users u LEFT JOIN leave_balances lb ON lb.user_id = u.id AND lb.balance_year = $2
         WHERE u.id = $1
       ), usage AS (
         SELECT COALESCE(SUM(CASE
                  WHEN ld.leave_period = 'hourly' THEN ld.duration_minutes
                  WHEN ld.leave_period IN ('morning', 'afternoon') THEN COALESCE(ws.standard_minutes, 480) / 2
                  ELSE COALESCE(ws.standard_minutes, 480)
                END), 0)::int AS used_minutes,
                COUNT(*)::int AS leave_count
         FROM leave_days ld
         LEFT JOIN work_schedules ws ON ws.user_id = ld.user_id
              AND ws.day_of_week = EXTRACT(ISODOW FROM ld.leave_date)::int
         WHERE ld.user_id = $1 AND EXTRACT(YEAR FROM ld.leave_date)::int = $2
               AND ld.leave_type = 'paid_leave'
       )
       SELECT c.allowance_minutes, c.carried_minutes, u.used_minutes, u.leave_count
       FROM configuration c CROSS JOIN usage u`,
      [userId, year],
    );
    return result.rows[0]!;
  }
}
