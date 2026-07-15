import { AppError } from "../../common/errors/app-error.js";
import { getPool } from "../../infrastructure/database/pool.js";
import { withTransaction } from "../../infrastructure/database/transaction.js";
import { AttendanceRepository } from "../../infrastructure/repositories/attendance-repository.js";
import { LeaveRepository, type LeaveRow } from "../../infrastructure/repositories/leave-repository.js";
import type { LeaveInput, LeaveListQuery } from "../validators/leave-schemas.js";

function mapLeave(row: LeaveRow) {
  return {
    id: row.id,
    leaveDate: row.leave_date,
    leaveType: row.leave_type,
    leavePeriod: row.leave_period,
    durationMinutes: row.duration_minutes,
    reason: row.reason,
    createdAt: row.created_at.toISOString(),
  };
}

export class LeaveService {
  static async list(userId: string, query: LeaveListQuery) {
    const result = await LeaveRepository.list(getPool(), userId, query);
    return { items: result.rows.map(mapLeave), page: query.page, pageSize: query.pageSize, total: result.total };
  }

  static async create(userId: string, input: LeaveInput) {
    return withTransaction(async (db) => {
      await AttendanceRepository.lockUser(db, userId);
      const leave = await LeaveRepository.create(db, userId, input);
      await LeaveRepository.syncAttendanceDay(db, userId, input.leaveDate);
      await AttendanceRepository.audit(db, userId, "leave_day", leave.id, "create", leave, crypto.randomUUID());
      return mapLeave(leave);
    });
  }

  static async update(userId: string, id: string, input: LeaveInput) {
    return withTransaction(async (db) => {
      await AttendanceRepository.lockUser(db, userId);
      const before = await LeaveRepository.find(db, userId, id);
      if (!before) throw new AppError(404, "LEAVE_NOT_FOUND", "Khong tim thay ngay nghi");
      const leave = await LeaveRepository.update(db, userId, id, input);
      if (!leave) throw new AppError(404, "LEAVE_NOT_FOUND", "Khong tim thay ngay nghi");
      if (before.leave_date !== input.leaveDate) await LeaveRepository.clearAttendanceLeave(db, userId, before.leave_date);
      await LeaveRepository.syncAttendanceDay(db, userId, input.leaveDate);
      await AttendanceRepository.audit(db, userId, "leave_day", id, "update", leave, crypto.randomUUID());
      return mapLeave(leave);
    });
  }

  static async delete(userId: string, id: string): Promise<void> {
    await withTransaction(async (db) => {
      await AttendanceRepository.lockUser(db, userId);
      const before = await LeaveRepository.find(db, userId, id);
      if (!before) throw new AppError(404, "LEAVE_NOT_FOUND", "Khong tim thay ngay nghi");
      await LeaveRepository.delete(db, userId, id);
      await LeaveRepository.clearAttendanceLeave(db, userId, before.leave_date);
    });
  }

  static async balance(userId: string, year: number) {
    const row = await LeaveRepository.balance(getPool(), userId, year);
    const total = row.allowance_minutes + row.carried_minutes;
    return {
      year,
      allowanceMinutes: row.allowance_minutes,
      carriedMinutes: row.carried_minutes,
      usedMinutes: row.used_minutes,
      remainingMinutes: Math.max(0, total - row.used_minutes),
      leaveCount: row.leave_count,
    };
  }
}
