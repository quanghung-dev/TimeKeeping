import { AppError } from "../../common/errors/app-error.js";
import { getPool } from "../../infrastructure/database/pool.js";
import { withTransaction } from "../../infrastructure/database/transaction.js";
import { AttendanceRepository } from "../../infrastructure/repositories/attendance-repository.js";
import { OvertimeRepository, type OvertimeRow } from "../../infrastructure/repositories/overtime-repository.js";
import type { OvertimeInput } from "../validators/overtime-schemas.js";

function map(row: OvertimeRow) {
  const minutes = row.ended_at ? Math.max(0, Math.round((row.ended_at.getTime() - row.started_at.getTime()) / 60_000)) : null;
  return { id: row.id, startedAt: row.started_at.toISOString(), endedAt: row.ended_at?.toISOString() ?? null, overtimeType: row.overtime_type, multiplier: row.multiplier, source: row.source, note: row.note, minutes };
}
export class OvertimeService {
  static async list(userId: string, start: string, end: string) { return (await OvertimeRepository.list(getPool(), userId, start, end)).map(map); }
  static async active(userId: string) { const row = await OvertimeRepository.active(getPool(), userId); return row ? map(row) : null; }
  static async start(userId: string, input: { overtimeType: string; multiplier: number; note?: string | null }) {
    return withTransaction(async (db) => { await AttendanceRepository.lockUser(db, userId); if (await OvertimeRepository.active(db, userId, true)) throw new AppError(409, "OVERTIME_ALREADY_ACTIVE", "Da co phien lam them dang hoat dong"); return map(await OvertimeRepository.start(db, userId, input.overtimeType, input.multiplier, input.note ?? null)); });
  }
  static async end(userId: string, note?: string | null) {
    return withTransaction(async (db) => { await AttendanceRepository.lockUser(db, userId); const active = await OvertimeRepository.active(db, userId, true); if (!active) throw new AppError(409, "NO_ACTIVE_OVERTIME", "Khong co phien lam them dang hoat dong"); return map(await OvertimeRepository.end(db, active.id, note ?? null)); });
  }
  static async create(userId: string, input: OvertimeInput) { return map(await OvertimeRepository.create(getPool(), userId, input)); }
  static async update(userId: string, id: string, input: OvertimeInput) { const row = await OvertimeRepository.update(getPool(), userId, id, input); if (!row) throw new AppError(404, "OVERTIME_NOT_FOUND", "Khong tim thay phien lam them"); return map(row); }
  static async delete(userId: string, id: string) { if (!(await OvertimeRepository.delete(getPool(), userId, id))) throw new AppError(404, "OVERTIME_NOT_FOUND", "Khong tim thay phien lam them"); }
  static async summary(userId: string, start: string, end: string) {
    const items = await this.list(userId, start, end);
    const byType = { weekday: 0, weekend: 0, holiday: 0 };
    let weightedMinutes = 0;
    for (const item of items) { const minutes = item.minutes ?? 0; byType[item.overtimeType] += minutes; weightedMinutes += minutes * Number(item.multiplier); }
    return { totalMinutes: Object.values(byType).reduce((a, b) => a + b, 0), weightedMinutes, byType, count: items.length };
  }
}
