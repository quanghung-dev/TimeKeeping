import { AppError } from "../../common/errors/app-error.js";
import { getPool } from "../../infrastructure/database/pool.js";
import { withTransaction } from "../../infrastructure/database/transaction.js";
import { CalendarRepository, type CalendarEventRow } from "../../infrastructure/repositories/calendar-repository.js";
import type { CalendarEventInput, CalendarRange, RecurringEventInput } from "../validators/calendar-schemas.js";

function mapEvent(row: CalendarEventRow) {
  return { id: row.id, title: row.title, eventType: row.event_type, startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString(), isAllDay: row.is_all_day, note: row.note };
}

export class CalendarService {
  static async list(userId: string, range: CalendarRange) {
    const days = (new Date(`${range.end}T00:00:00Z`).getTime() - new Date(`${range.start}T00:00:00Z`).getTime()) / 86_400_000;
    if (days > 366) throw new AppError(400, "CALENDAR_RANGE_TOO_LARGE", "Khoang lich toi da 366 ngay");
    const rows = await CalendarRepository.list(getPool(), userId, range);
    return rows.map((row) => ({ id: row.id, itemType: row.item_type, title: row.title, startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString(), isAllDay: row.is_all_day, status: row.status, actualMinutes: row.actual_minutes }));
  }
  static async create(userId: string, input: CalendarEventInput) { return mapEvent(await CalendarRepository.create(getPool(), userId, input)); }
  static async update(userId: string, id: string, input: CalendarEventInput) {
    const row = await CalendarRepository.update(getPool(), userId, id, input);
    if (!row) throw new AppError(404, "CALENDAR_EVENT_NOT_FOUND", "Khong tim thay su kien lich");
    return mapEvent(row);
  }
  static async delete(userId: string, id: string) {
    if (!(await CalendarRepository.delete(getPool(), userId, id))) throw new AppError(404, "CALENDAR_EVENT_NOT_FOUND", "Khong tim thay su kien lich");
  }
  static copyPreviousWeek(userId: string, weekStart: string) { return withTransaction(async (db) => ({ created: await CalendarRepository.copyPreviousWeek(db, userId, weekStart) })); }
  static recurring(userId: string, input: RecurringEventInput) { return withTransaction(async (db) => ({ created: await CalendarRepository.createRecurring(db, userId, input) })); }
}
