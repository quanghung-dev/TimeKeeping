import type { Pool, PoolClient } from "pg";
import type { UpdateWorkSettingsInput, WorkShiftInput } from "../../application/validators/work-settings-schemas.js";
import type { WorkSchedule, WorkSettings, WorkShift } from "../../domain/models/work-settings.js";

interface SettingsRow {
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
  overtime_after_minutes: number;
  rounding_minutes: 0 | 5 | 10 | 15;
  auto_detect_overtime: boolean;
  auto_deduct_break: boolean;
  schedule_mode: WorkSettings["scheduleMode"];
  earliest_check_in_minutes: number;
  latest_check_in_minutes: number;
  standard_work_days_per_month: string;
  checkout_open_break_policy: WorkSettings["checkoutOpenBreakPolicy"];
  max_session_minutes: number;
  overtime_rule: WorkSettings["overtimeRule"];
}

interface ScheduleRow {
  id: string;
  day_of_week: number;
  is_working_day: boolean;
  start_time: string | null;
  end_time: string | null;
  standard_minutes: number;
  default_break_minutes: number;
  shift_ids: string[];
}

interface ShiftRow {
  id: string;
  name: string;
  color: string;
  start_time: string;
  end_time: string;
  standard_minutes: number;
  default_break_minutes: number;
  is_active: boolean;
}

function mapSchedule(row: ScheduleRow): WorkSchedule {
  return {
    id: row.id,
    dayOfWeek: row.day_of_week,
    isWorkingDay: row.is_working_day,
    startTime: row.start_time?.slice(0, 5) ?? null,
    endTime: row.end_time?.slice(0, 5) ?? null,
    standardMinutes: row.standard_minutes,
    defaultBreakMinutes: row.default_break_minutes,
    shiftIds: row.shift_ids,
  };
}

function mapShift(row: ShiftRow): WorkShift {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    standardMinutes: row.standard_minutes,
    defaultBreakMinutes: row.default_break_minutes,
    isActive: row.is_active,
  };
}

export class WorkSettingsRepository {
  static async getSettings(db: Pool, userId: string): Promise<SettingsRow | null> {
    const result = await db.query<SettingsRow>(
      `SELECT late_grace_minutes, early_leave_grace_minutes, overtime_after_minutes,
              rounding_minutes, auto_detect_overtime, auto_deduct_break, schedule_mode,
              earliest_check_in_minutes, latest_check_in_minutes,
              standard_work_days_per_month::text, checkout_open_break_policy,
              max_session_minutes, overtime_rule
       FROM user_settings WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  static async getSchedules(db: Pool, userId: string): Promise<WorkSchedule[]> {
    const result = await db.query<ScheduleRow>(
      `SELECT ws.id, ws.day_of_week, ws.is_working_day, ws.start_time::text,
              ws.end_time::text, ws.standard_minutes, ws.default_break_minutes,
              COALESCE(
                array_agg(wss.work_shift_id ORDER BY wss.sort_order)
                  FILTER (WHERE wss.work_shift_id IS NOT NULL),
                ARRAY[]::uuid[]
              ) AS shift_ids
       FROM work_schedules ws
       LEFT JOIN work_schedule_shifts wss ON wss.work_schedule_id = ws.id
       WHERE ws.user_id = $1
       GROUP BY ws.id
       ORDER BY ws.day_of_week`,
      [userId],
    );
    return result.rows.map(mapSchedule);
  }

  static async getShifts(db: Pool | PoolClient, userId: string): Promise<WorkShift[]> {
    const result = await db.query<ShiftRow>(
      `SELECT id, name, color, start_time::text, end_time::text,
              standard_minutes, default_break_minutes, is_active
       FROM work_shifts WHERE user_id = $1 ORDER BY start_time, name`,
      [userId],
    );
    return result.rows.map(mapShift);
  }

  static async updateSettings(
    db: PoolClient,
    userId: string,
    input: UpdateWorkSettingsInput,
  ): Promise<void> {
    await db.query(
      `UPDATE user_settings
       SET late_grace_minutes = $2, early_leave_grace_minutes = $3,
           overtime_after_minutes = $4, rounding_minutes = $5,
           auto_detect_overtime = $6, auto_deduct_break = $7,
           schedule_mode = $8, earliest_check_in_minutes = $9,
           latest_check_in_minutes = $10, standard_work_days_per_month = $11,
           checkout_open_break_policy = $12, max_session_minutes = $13,
           overtime_rule = $14
       WHERE user_id = $1`,
      [
        userId,
        input.lateGraceMinutes,
        input.earlyLeaveGraceMinutes,
        input.overtimeAfterMinutes,
        input.roundingMinutes,
        input.autoDetectOvertime,
        input.autoDeductBreak,
        input.scheduleMode,
        input.earliestCheckInMinutes,
        input.latestCheckInMinutes,
        input.standardWorkDaysPerMonth,
        input.checkoutOpenBreakPolicy,
        input.maxSessionMinutes,
        input.overtimeRule,
      ],
    );
  }

  static async updateSchedules(
    db: PoolClient,
    userId: string,
    input: UpdateWorkSettingsInput,
  ): Promise<boolean> {
    for (const schedule of input.schedules) {
      const result = await db.query<{ id: string }>(
        `INSERT INTO work_schedules
          (user_id, day_of_week, is_working_day, start_time, end_time, standard_minutes, default_break_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, day_of_week) DO UPDATE
         SET is_working_day = EXCLUDED.is_working_day,
             start_time = EXCLUDED.start_time,
             end_time = EXCLUDED.end_time,
             standard_minutes = EXCLUDED.standard_minutes,
             default_break_minutes = EXCLUDED.default_break_minutes
         RETURNING id`,
        [
          userId,
          schedule.dayOfWeek,
          schedule.isWorkingDay,
          schedule.startTime,
          schedule.endTime,
          schedule.standardMinutes,
          schedule.defaultBreakMinutes,
        ],
      );
      const scheduleId = result.rows[0]?.id;
      if (!scheduleId) return false;
      await db.query(`DELETE FROM work_schedule_shifts WHERE work_schedule_id = $1`, [scheduleId]);
      if (schedule.shiftIds.length > 0) {
        const linked = await db.query(
          `INSERT INTO work_schedule_shifts (work_schedule_id, work_shift_id, sort_order)
           SELECT $1, shifts.id, requested.ordinality - 1
           FROM unnest($2::uuid[]) WITH ORDINALITY AS requested(id, ordinality)
           INNER JOIN work_shifts shifts ON shifts.id = requested.id AND shifts.user_id = $3`,
          [scheduleId, schedule.shiftIds, userId],
        );
        if (linked.rowCount !== schedule.shiftIds.length) return false;
      }
    }
    return true;
  }

  static async createShift(db: Pool, userId: string, input: WorkShiftInput): Promise<WorkShift> {
    const result = await db.query<ShiftRow>(
      `INSERT INTO work_shifts
        (user_id, name, color, start_time, end_time, standard_minutes, default_break_minutes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, color, start_time::text, end_time::text,
                 standard_minutes, default_break_minutes, is_active`,
      [userId, input.name, input.color, input.startTime, input.endTime, input.standardMinutes, input.defaultBreakMinutes, input.isActive],
    );
    return mapShift(result.rows[0]!);
  }

  static async updateShift(
    db: Pool,
    userId: string,
    shiftId: string,
    input: WorkShiftInput,
  ): Promise<WorkShift | null> {
    const result = await db.query<ShiftRow>(
      `UPDATE work_shifts
       SET name = $3, color = $4, start_time = $5, end_time = $6,
           standard_minutes = $7, default_break_minutes = $8, is_active = $9
       WHERE id = $2 AND user_id = $1
       RETURNING id, name, color, start_time::text, end_time::text,
                 standard_minutes, default_break_minutes, is_active`,
      [userId, shiftId, input.name, input.color, input.startTime, input.endTime, input.standardMinutes, input.defaultBreakMinutes, input.isActive],
    );
    return result.rows[0] ? mapShift(result.rows[0]) : null;
  }

  static async deleteShift(db: Pool, userId: string, shiftId: string): Promise<boolean> {
    const result = await db.query(`DELETE FROM work_shifts WHERE id = $2 AND user_id = $1`, [userId, shiftId]);
    return result.rowCount === 1;
  }
}
