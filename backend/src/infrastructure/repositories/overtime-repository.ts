import type { Pool, PoolClient } from "pg";
import type { OvertimeInput } from "../../application/validators/overtime-schemas.js";

export interface OvertimeRow { id: string; started_at: Date; ended_at: Date | null; overtime_type: "weekday" | "weekend" | "holiday"; multiplier: string; source: "manual" | "automatic"; note: string | null; }
export class OvertimeRepository {
  static async list(db: Pool, userId: string, start: string, end: string): Promise<OvertimeRow[]> {
    const result = await db.query<OvertimeRow>(`SELECT id, started_at, ended_at, overtime_type, multiplier::text, source, note FROM overtime_sessions WHERE user_id = $1 AND started_at >= $2::date AND started_at < ($3::date + 1) ORDER BY started_at DESC`, [userId, start, end]);
    return result.rows;
  }
  static async active(db: Pool | PoolClient, userId: string, lock = false): Promise<OvertimeRow | null> {
    const result = await db.query<OvertimeRow>(`SELECT id, started_at, ended_at, overtime_type, multiplier::text, source, note FROM overtime_sessions WHERE user_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1 ${lock ? "FOR UPDATE" : ""}`, [userId]);
    return result.rows[0] ?? null;
  }
  static async start(db: PoolClient, userId: string, type: string, multiplier: number, note: string | null): Promise<OvertimeRow> {
    const result = await db.query<OvertimeRow>(`INSERT INTO overtime_sessions (user_id, started_at, overtime_type, multiplier, source, note) VALUES ($1, NOW(), $2, $3, 'manual', $4) RETURNING id, started_at, ended_at, overtime_type, multiplier::text, source, note`, [userId, type, multiplier, note]); return result.rows[0]!;
  }
  static async end(db: PoolClient, id: string, note: string | null): Promise<OvertimeRow> {
    const result = await db.query<OvertimeRow>(`UPDATE overtime_sessions SET ended_at = NOW(), note = COALESCE($2, note) WHERE id = $1 RETURNING id, started_at, ended_at, overtime_type, multiplier::text, source, note`, [id, note]); return result.rows[0]!;
  }
  static async create(db: Pool, userId: string, input: OvertimeInput): Promise<OvertimeRow> {
    const result = await db.query<OvertimeRow>(`INSERT INTO overtime_sessions (user_id, started_at, ended_at, overtime_type, multiplier, source, note) VALUES ($1, $2, $3, $4, $5, 'manual', $6) RETURNING id, started_at, ended_at, overtime_type, multiplier::text, source, note`, [userId, input.startedAt, input.endedAt, input.overtimeType, input.multiplier, input.note ?? null]); return result.rows[0]!;
  }
  static async update(db: Pool, userId: string, id: string, input: OvertimeInput): Promise<OvertimeRow | null> {
    const result = await db.query<OvertimeRow>(`UPDATE overtime_sessions SET started_at=$3, ended_at=$4, overtime_type=$5, multiplier=$6, note=$7 WHERE user_id=$1 AND id=$2 RETURNING id, started_at, ended_at, overtime_type, multiplier::text, source, note`, [userId, id, input.startedAt, input.endedAt, input.overtimeType, input.multiplier, input.note ?? null]); return result.rows[0] ?? null;
  }
  static async delete(db: Pool, userId: string, id: string): Promise<boolean> { const result = await db.query(`DELETE FROM overtime_sessions WHERE user_id=$1 AND id=$2`, [userId, id]); return result.rowCount === 1; }
}
