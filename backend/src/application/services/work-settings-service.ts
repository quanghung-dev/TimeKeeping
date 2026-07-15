import { AppError } from "../../common/errors/app-error.js";
import type { WorkSettings, WorkShift } from "../../domain/models/work-settings.js";
import { getPool } from "../../infrastructure/database/pool.js";
import { withTransaction } from "../../infrastructure/database/transaction.js";
import { WorkSettingsRepository } from "../../infrastructure/repositories/work-settings-repository.js";
import type { UpdateWorkSettingsInput, WorkShiftInput } from "../validators/work-settings-schemas.js";

export class WorkSettingsService {
  static async get(userId: string): Promise<WorkSettings> {
    const pool = getPool();
    const [settings, schedules, shifts] = await Promise.all([
      WorkSettingsRepository.getSettings(pool, userId),
      WorkSettingsRepository.getSchedules(pool, userId),
      WorkSettingsRepository.getShifts(pool, userId),
    ]);
    if (!settings) throw new AppError(404, "WORK_SETTINGS_NOT_FOUND", "Khong tim thay cau hinh lam viec");
    return {
      lateGraceMinutes: settings.late_grace_minutes,
      earlyLeaveGraceMinutes: settings.early_leave_grace_minutes,
      overtimeAfterMinutes: settings.overtime_after_minutes,
      roundingMinutes: settings.rounding_minutes,
      autoDetectOvertime: settings.auto_detect_overtime,
      autoDeductBreak: settings.auto_deduct_break,
      scheduleMode: settings.schedule_mode,
      earliestCheckInMinutes: settings.earliest_check_in_minutes,
      latestCheckInMinutes: settings.latest_check_in_minutes,
      standardWorkDaysPerMonth: settings.standard_work_days_per_month,
      checkoutOpenBreakPolicy: settings.checkout_open_break_policy,
      maxSessionMinutes: settings.max_session_minutes,
      overtimeRule: settings.overtime_rule,
      schedules,
      shifts,
    };
  }

  static async update(userId: string, input: UpdateWorkSettingsInput): Promise<WorkSettings> {
    await withTransaction(async (client) => {
      await WorkSettingsRepository.updateSettings(client, userId, input);
      if (!(await WorkSettingsRepository.updateSchedules(client, userId, input))) {
        throw new AppError(400, "SHIFT_OWNERSHIP_INVALID", "Mot hoac nhieu ca lam khong hop le");
      }
    });
    return this.get(userId);
  }

  static listShifts(userId: string): Promise<WorkShift[]> {
    return WorkSettingsRepository.getShifts(getPool(), userId);
  }

  static createShift(userId: string, input: WorkShiftInput): Promise<WorkShift> {
    return WorkSettingsRepository.createShift(getPool(), userId, input);
  }

  static async updateShift(userId: string, shiftId: string, input: WorkShiftInput): Promise<WorkShift> {
    const shift = await WorkSettingsRepository.updateShift(getPool(), userId, shiftId, input);
    if (!shift) throw new AppError(404, "WORK_SHIFT_NOT_FOUND", "Khong tim thay ca lam");
    return shift;
  }

  static async deleteShift(userId: string, shiftId: string): Promise<void> {
    if (!(await WorkSettingsRepository.deleteShift(getPool(), userId, shiftId))) {
      throw new AppError(404, "WORK_SHIFT_NOT_FOUND", "Khong tim thay ca lam");
    }
  }
}
