import type { Pool, PoolClient } from "pg";
import type { AttendanceStatus } from "../../domain/models/attendance.js";

export interface AttendanceContextRow {
  work_date: string;
  timezone: string;
  schedule_id: string | null;
  is_working_day: boolean;
  scheduled_start_at: Date | null;
  scheduled_end_at: Date | null;
  required_minutes: number;
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
  overtime_after_minutes: number;
  rounding_minutes: 0 | 5 | 10 | 15;
  schedule_mode: "fixed" | "flexible" | "shift";
  earliest_check_in_minutes: number;
  latest_check_in_minutes: number;
  checkout_open_break_policy: "require_end" | "auto_end";
  max_session_minutes: number;
}

export interface AttendanceDayRow {
  id: string;
  status: AttendanceStatus;
  manual_adjustment_minutes: number;
}

export interface SessionRow {
  id: string;
  attendance_day_id?: string;
  work_date?: string;
  shift_id: string | null;
  check_in_at: Date;
  check_out_at: Date | null;
  check_in_source: string;
  check_out_source: string | null;
  note: string | null;
}

export interface BreakRow {
  id: string;
  attendance_session_id: string;
  break_type: "lunch" | "short_break" | "personal" | "outside" | "other";
  started_at: Date;
  ended_at: Date | null;
  note: string | null;
}
export interface OwnedBreakRow extends BreakRow { attendance_day_id: string; work_date: string; check_in_at: Date; check_out_at: Date | null; }

export class AttendanceRepository {
  static async findOwnedSession(db: PoolClient, userId: string, sessionId: string): Promise<SessionRow | null> {
    const result = await db.query<SessionRow>(`SELECT s.id,s.attendance_day_id,d.work_date::text,s.shift_id,s.check_in_at,s.check_out_at,s.check_in_source,s.check_out_source,s.note FROM attendance_sessions s JOIN attendance_days d ON d.id=s.attendance_day_id WHERE d.user_id=$1 AND s.id=$2 FOR UPDATE OF s`,[userId,sessionId]);
    return result.rows[0]??null;
  }
  static async hasOverlap(db: PoolClient,userId:string,start:Date,end:Date|null,excludeId:string|null):Promise<boolean>{const result=await db.query(`SELECT 1 FROM attendance_sessions s JOIN attendance_days d ON d.id=s.attendance_day_id WHERE d.user_id=$1 AND($4::uuid IS NULL OR s.id<>$4)AND s.check_in_at<COALESCE($3::timestamptz,'infinity')AND COALESCE(s.check_out_at,'infinity')>$2 LIMIT 1`,[userId,start,end,excludeId]);return result.rowCount===1;}
  static async updateManualSession(db:PoolClient,id:string,start:Date,end:Date|null,shiftId:string|null,note:string|null):Promise<void>{await db.query(`UPDATE attendance_sessions SET check_in_at=$2,check_out_at=$3,shift_id=$4,note=$5,check_in_source='manual',check_out_source=CASE WHEN $3::timestamptz IS NULL THEN NULL ELSE 'manual' END WHERE id=$1`,[id,start,end,shiftId,note]);}
  static async deleteSession(db:PoolClient,id:string):Promise<void>{await db.query(`DELETE FROM attendance_sessions WHERE id=$1`,[id]);}
  static async recalculateDayStatus(db:PoolClient,dayId:string):Promise<void>{await db.query(`UPDATE attendance_days d SET status=CASE WHEN EXISTS(SELECT 1 FROM attendance_sessions s JOIN break_sessions b ON b.attendance_session_id=s.id WHERE s.attendance_day_id=d.id AND s.check_out_at IS NULL AND b.ended_at IS NULL)THEN 'on_break' WHEN EXISTS(SELECT 1 FROM attendance_sessions s WHERE s.attendance_day_id=d.id AND s.check_out_at IS NULL)THEN 'working' WHEN EXISTS(SELECT 1 FROM attendance_sessions s WHERE s.attendance_day_id=d.id)THEN 'completed' WHEN d.status IN('leave','holiday')THEN d.status ELSE 'not_started' END WHERE d.id=$1`,[dayId]);}
  static async latestSession(db:PoolClient,userId:string):Promise<SessionRow|null>{const result=await db.query<SessionRow>(`SELECT s.id,s.attendance_day_id,d.work_date::text,s.shift_id,s.check_in_at,s.check_out_at,s.check_in_source,s.check_out_source,s.note FROM attendance_sessions s JOIN attendance_days d ON d.id=s.attendance_day_id WHERE d.user_id=$1 ORDER BY COALESCE(s.check_out_at,s.check_in_at) DESC LIMIT 1 FOR UPDATE OF s`,[userId]);return result.rows[0]??null;}
  static async lockUser(db: PoolClient, userId: string): Promise<void> {
    await db.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [userId]);
  }

  static async getContext(
    db: Pool | PoolClient,
    userId: string,
    workDate: string | null,
    eventAt: Date | null = null,
  ): Promise<AttendanceContextRow | null> {
    const result = await db.query<AttendanceContextRow>(
      `WITH user_context AS (
         SELECT u.timezone, us.late_grace_minutes, us.early_leave_grace_minutes,
                us.overtime_after_minutes, us.rounding_minutes, us.schedule_mode,
                us.earliest_check_in_minutes, us.latest_check_in_minutes,
                us.checkout_open_break_policy, us.max_session_minutes,
                COALESCE(
                  $2::date,
                  ($3::timestamptz AT TIME ZONE u.timezone)::date,
                  (NOW() AT TIME ZONE u.timezone)::date
                ) AS work_date
         FROM users u
         JOIN user_settings us ON us.user_id = u.id
         WHERE u.id = $1
       )
       SELECT uc.work_date::text, uc.timezone, ws.id AS schedule_id,
              COALESCE(ws.is_working_day, FALSE) AS is_working_day,
              CASE WHEN ws.start_time IS NULL THEN NULL
                   ELSE (uc.work_date + ws.start_time) AT TIME ZONE uc.timezone END AS scheduled_start_at,
              CASE WHEN ws.end_time IS NULL THEN NULL
                   ELSE (uc.work_date + ws.end_time +
                         CASE WHEN ws.start_time IS NOT NULL AND ws.end_time <= ws.start_time
                              THEN INTERVAL '1 day' ELSE INTERVAL '0 day' END)
                        AT TIME ZONE uc.timezone END AS scheduled_end_at,
              COALESCE(ws.standard_minutes, 0) AS required_minutes,
              uc.late_grace_minutes, uc.early_leave_grace_minutes,
              uc.overtime_after_minutes, uc.rounding_minutes, uc.schedule_mode,
              uc.earliest_check_in_minutes, uc.latest_check_in_minutes,
              uc.checkout_open_break_policy, uc.max_session_minutes
       FROM user_context uc
       LEFT JOIN work_schedules ws
         ON ws.user_id = $1 AND ws.day_of_week = EXTRACT(ISODOW FROM uc.work_date)::int`,
      [userId, workDate, eventAt],
    );
    return result.rows[0] ?? null;
  }

  static async getOrCreateDay(
    db: PoolClient,
    userId: string,
    context: AttendanceContextRow,
  ): Promise<AttendanceDayRow> {
    const initialStatus: AttendanceStatus = context.is_working_day ? "not_started" : "day_off";
    const result = await db.query<AttendanceDayRow>(
      `INSERT INTO attendance_days (user_id, work_date, schedule_id, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, work_date) DO UPDATE
       SET schedule_id = COALESCE(attendance_days.schedule_id, EXCLUDED.schedule_id)
       RETURNING id, status, manual_adjustment_minutes`,
      [userId, context.work_date, context.schedule_id, initialStatus],
    );
    return result.rows[0]!;
  }

  static async findDay(db: Pool | PoolClient, userId: string, workDate: string): Promise<AttendanceDayRow | null> {
    const result = await db.query<AttendanceDayRow>(
      `SELECT id, status, manual_adjustment_minutes
       FROM attendance_days WHERE user_id = $1 AND work_date = $2`,
      [userId, workDate],
    );
    return result.rows[0] ?? null;
  }

  static async findActiveSession(db: PoolClient, userId: string): Promise<SessionRow | null> {
    const result = await db.query<SessionRow>(
      `SELECT s.id, s.attendance_day_id, d.work_date::text, s.shift_id, s.check_in_at, s.check_out_at,
              s.check_in_source, s.check_out_source, s.note
       FROM attendance_sessions s
       JOIN attendance_days d ON d.id = s.attendance_day_id
       WHERE d.user_id = $1 AND s.check_out_at IS NULL
       ORDER BY s.check_in_at DESC LIMIT 1 FOR UPDATE OF s`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  static async verifyShift(db: PoolClient, userId: string, shiftId: string): Promise<boolean> {
    const result = await db.query(`SELECT 1 FROM work_shifts WHERE id = $2 AND user_id = $1 AND is_active`, [userId, shiftId]);
    return result.rowCount === 1;
  }

  static async createSession(
    db: PoolClient,
    dayId: string,
    input: {
      at: Date;
      source: string;
      note?: string | undefined;
      shiftId?: string | null | undefined;
      localTimestamp?: string | undefined;
      deviceId?: string | undefined;
    },
  ): Promise<SessionRow> {
    const result = await db.query<SessionRow>(
      `INSERT INTO attendance_sessions
        (attendance_day_id, shift_id, check_in_at, check_in_source, note, client_recorded_at, device_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, shift_id, check_in_at, check_out_at, check_in_source, check_out_source, note`,
      [dayId, input.shiftId ?? null, input.at, input.source, input.note ?? null, input.localTimestamp ?? null, input.deviceId ?? null],
    );
    return result.rows[0]!;
  }

  static async closeSession(
    db: PoolClient,
    sessionId: string,
    at: Date,
    source: string,
    localTimestamp?: string,
    deviceId?: string,
    note?: string,
  ): Promise<void> {
    await db.query(
      `UPDATE attendance_sessions
       SET check_out_at = $2, check_out_source = $3,
           client_recorded_at = COALESCE($4, client_recorded_at),
           device_id = COALESCE($5, device_id), note = COALESCE($6, note)
       WHERE id = $1`,
      [sessionId, at, source, localTimestamp ?? null, deviceId ?? null, note ?? null],
    );
  }

  static async findActiveBreak(db: PoolClient, sessionId: string): Promise<BreakRow | null> {
    const result = await db.query<BreakRow>(
      `SELECT id, attendance_session_id, break_type, started_at, ended_at, note
       FROM break_sessions WHERE attendance_session_id = $1 AND ended_at IS NULL
       ORDER BY started_at DESC LIMIT 1 FOR UPDATE`,
      [sessionId],
    );
    return result.rows[0] ?? null;
  }
  static async findOwnedBreak(db:PoolClient,userId:string,id:string):Promise<OwnedBreakRow|null>{const result=await db.query<OwnedBreakRow>(`SELECT b.id,b.attendance_session_id,b.break_type,b.started_at,b.ended_at,b.note,s.attendance_day_id,d.work_date::text,s.check_in_at,s.check_out_at FROM break_sessions b JOIN attendance_sessions s ON s.id=b.attendance_session_id JOIN attendance_days d ON d.id=s.attendance_day_id WHERE d.user_id=$1 AND b.id=$2 FOR UPDATE OF b`,[userId,id]);return result.rows[0]??null;}
  static async updateBreak(db:PoolClient,id:string,input:{breakType:string;startedAt:Date;endedAt:Date|null;note:string|null}):Promise<void>{await db.query(`UPDATE break_sessions SET break_type=$2,started_at=$3,ended_at=$4,note=$5 WHERE id=$1`,[id,input.breakType,input.startedAt,input.endedAt,input.note]);}
  static async hasBreakOverlap(db:PoolClient,sessionId:string,start:Date,end:Date|null,excludeId:string):Promise<boolean>{return(await db.query(`SELECT 1 FROM break_sessions WHERE attendance_session_id=$1 AND id<>$4 AND started_at<COALESCE($3::timestamptz,'infinity') AND COALESCE(ended_at,'infinity')>$2 LIMIT 1`,[sessionId,start,end,excludeId])).rowCount===1;}
  static async deleteBreak(db:PoolClient,id:string):Promise<void>{await db.query(`DELETE FROM break_sessions WHERE id=$1`,[id]);}

  static async createBreak(
    db: PoolClient,
    sessionId: string,
    at: Date,
    breakType: string,
    note?: string,
  ): Promise<BreakRow> {
    const result = await db.query<BreakRow>(
      `INSERT INTO break_sessions (attendance_session_id, break_type, started_at, note)
       VALUES ($1, $2, $3, $4)
       RETURNING id, attendance_session_id, break_type, started_at, ended_at, note`,
      [sessionId, breakType, at, note ?? null],
    );
    return result.rows[0]!;
  }

  static async endBreak(db: PoolClient, breakId: string, at: Date, note?: string): Promise<void> {
    await db.query(
      `UPDATE break_sessions SET ended_at = $2, note = COALESCE($3, note) WHERE id = $1`,
      [breakId, at, note ?? null],
    );
  }

  static async setDayStatus(db: PoolClient, dayId: string, status: AttendanceStatus): Promise<void> {
    await db.query(`UPDATE attendance_days SET status = $2 WHERE id = $1`, [dayId, status]);
  }

  static async listSessions(db: Pool | PoolClient, dayId: string): Promise<SessionRow[]> {
    const result = await db.query<SessionRow>(
      `SELECT id, shift_id, check_in_at, check_out_at, check_in_source, check_out_source, note
       FROM attendance_sessions WHERE attendance_day_id = $1 ORDER BY check_in_at`,
      [dayId],
    );
    return result.rows;
  }

  static async listBreaks(db: Pool | PoolClient, dayId: string): Promise<BreakRow[]> {
    const result = await db.query<BreakRow>(
      `SELECT b.id, b.attendance_session_id, b.break_type, b.started_at, b.ended_at, b.note
       FROM break_sessions b
       JOIN attendance_sessions s ON s.id = b.attendance_session_id
       WHERE s.attendance_day_id = $1 ORDER BY b.started_at`,
      [dayId],
    );
    return result.rows;
  }

  static async audit(
    db: PoolClient,
    userId: string,
    entityType: string,
    entityId: string,
    action: "create" | "update",
    afterData: unknown,
    requestId: string,
  ): Promise<void> {
    await db.query(
      `INSERT INTO audit_logs (user_id, entity_type, entity_id, action, after_data, client_request_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, entityType, entityId, action, JSON.stringify(afterData), requestId],
    );
  }
}
