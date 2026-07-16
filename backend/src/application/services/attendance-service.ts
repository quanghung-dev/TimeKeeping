import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import type {
  AttendanceSessionDto,
  AttendanceSnapshot,
  BreakSessionDto,
} from "../../domain/models/attendance.js";
import { calculateAttendance } from "../../domain/services/attendance-calculator.js";
import { getPool } from "../../infrastructure/database/pool.js";
import { withTransaction } from "../../infrastructure/database/transaction.js";
import {
  AttendanceRepository,
  type AttendanceContextRow,
  type BreakRow,
  type SessionRow,
} from "../../infrastructure/repositories/attendance-repository.js";
import { IdempotencyRepository } from "../../infrastructure/repositories/idempotency-repository.js";
import type {
  AttendanceEventInput,
  BreakEndInput,
  BreakStartInput,
  CheckInInput,
  CheckOutInput,
} from "../validators/attendance-schemas.js";
import { ReportService } from "./report-service.js";

const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

function resolveEventTime(input: AttendanceEventInput): Date {
  if (input.source !== "offline") return new Date();
  const at = new Date(input.localTimestamp!);
  const now = Date.now();
  if (at.getTime() > now + FUTURE_TOLERANCE_MS) {
    throw new AppError(400, "OFFLINE_EVENT_IN_FUTURE", "Thoi gian tren thiet bi vuot qua gio may chu");
  }
  if (at.getTime() < now - OFFLINE_MAX_AGE_MS) {
    throw new AppError(400, "OFFLINE_EVENT_TOO_OLD", "Chi dong bo su kien trong vong 7 ngay");
  }
  return at;
}

function hashRequest(input: AttendanceEventInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function mapBreak(row: BreakRow): BreakSessionDto {
  return {
    id: row.id,
    breakType: row.break_type,
    startedAt: row.started_at.toISOString(),
    endedAt: row.ended_at?.toISOString() ?? null,
    note: row.note,
  };
}

function mapSession(row: SessionRow, breakRows: BreakRow[]): AttendanceSessionDto {
  return {
    id: row.id,
    shiftId: row.shift_id,
    checkInAt: row.check_in_at.toISOString(),
    checkOutAt: row.check_out_at?.toISOString() ?? null,
    checkInSource: row.check_in_source,
    checkOutSource: row.check_out_source,
    note: row.note,
    breaks: breakRows.filter((item) => item.attendance_session_id === row.id).map(mapBreak),
  };
}

async function buildSnapshot(
  db: Pool | PoolClient,
  userId: string,
  workDate: string | null,
): Promise<AttendanceSnapshot> {
  const context = await AttendanceRepository.getContext(db, userId, workDate);
  if (!context) throw new AppError(404, "USER_SETTINGS_NOT_FOUND", "Khong tim thay cau hinh nguoi dung");
  const day = await AttendanceRepository.findDay(db, userId, context.work_date);
  const [sessionRows, breakRows] = day
    ? await Promise.all([
        AttendanceRepository.listSessions(db, day.id),
        AttendanceRepository.listBreaks(db, day.id),
      ])
    : [[], []];
  const sessions = sessionRows.map((session) => mapSession(session, breakRows));
  const activeSession = sessions.find((session) => !session.checkOutAt) ?? null;
  const activeBreak = activeSession?.breaks.find((item) => !item.endedAt) ?? null;
  const totals = calculateAttendance({
    sessions: sessionRows.map((session) => ({ start: session.check_in_at, end: session.check_out_at })),
    breaks: breakRows.map((item) => ({ start: item.started_at, end: item.ended_at })),
    requiredMinutes: context.required_minutes,
    roundingMinutes: context.rounding_minutes,
    lateGraceMinutes: context.late_grace_minutes,
    earlyLeaveGraceMinutes: context.early_leave_grace_minutes,
    overtimeAfterMinutes: context.overtime_after_minutes,
    scheduledStart: context.scheduled_start_at,
    scheduledEnd: context.scheduled_end_at,
  });
  const flags: string[] = [];
  if (totals.lateMinutes > 0) flags.push("late");
  if (totals.earlyLeaveMinutes > 0) flags.push("early_leave");
  if (!activeSession && sessions.length > 0 && totals.missingMinutes > 0) flags.push("missing_time");
  if (totals.overtimeMinutes > 0) flags.push("overtime");
  if (activeSession && Date.now() - new Date(activeSession.checkInAt).getTime() > context.max_session_minutes * 60_000) {
    flags.push("long_running_session");
  }
  return {
    workDate: context.work_date,
    timezone: context.timezone,
    status: day?.status ?? (context.is_working_day ? "not_started" : "day_off"),
    schedule: {
      id: context.schedule_id,
      isWorkingDay: context.is_working_day,
      startAt: context.scheduled_start_at?.toISOString() ?? null,
      endAt: context.scheduled_end_at?.toISOString() ?? null,
      requiredMinutes: context.required_minutes,
    },
    sessions,
    activeSession,
    activeBreak,
    totals,
    flags,
  };
}

async function beginIdempotent(
  db: PoolClient,
  userId: string,
  operation: string,
  input: AttendanceEventInput,
): Promise<AttendanceSnapshot | null> {
  await AttendanceRepository.lockUser(db, userId);
  const requestHash = hashRequest(input);
  const existing = await IdempotencyRepository.find(db, userId, input.clientRequestId, operation);
  if (existing) {
    if (existing.request_hash !== requestHash) {
      throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "Ma yeu cau da duoc dung voi du lieu khac");
    }
    if (!existing.completed_at || !existing.response_body) {
      throw new AppError(409, "REQUEST_IN_PROGRESS", "Yeu cau dang duoc xu ly");
    }
    return existing.response_body as AttendanceSnapshot;
  }
  await IdempotencyRepository.create(db, userId, input.clientRequestId, operation, requestHash);
  return null;
}

async function completeIdempotent(
  db: PoolClient,
  userId: string,
  operation: string,
  input: AttendanceEventInput,
  snapshot: AttendanceSnapshot,
  resourceType: string,
  resourceId: string,
): Promise<AttendanceSnapshot> {
  await IdempotencyRepository.complete(
    db,
    userId,
    input.clientRequestId,
    operation,
    200,
    snapshot,
    resourceType,
    resourceId,
  );
  return snapshot;
}

export function validateCheckInWindow(context: AttendanceContextRow, eventAt: Date): void {
  if (eventAt.getTime() < context.check_in_window_start_at.getTime()) {
    throw new AppError(409, "CHECK_IN_TOO_EARLY", "Chua den khung gio duoc phep cham cong");
  }
  if (eventAt.getTime() > context.check_in_window_end_at.getTime()) {
    throw new AppError(409, "CHECK_IN_TOO_LATE", "Da qua khung gio duoc phep cham cong");
  }
}

export class AttendanceService {
  static daily(userId:string,start:string,end:string){return ReportService.range(userId,start,end);}
  static async activeState(userId:string){return withTransaction(async db=>{await AttendanceRepository.lockUser(db,userId);const session=await AttendanceRepository.findActiveSession(db,userId);if(!session?.work_date)return{activeSession:null,activeBreak:null};const snapshot=await buildSnapshot(db,userId,session.work_date);return{activeSession:snapshot.activeSession,activeBreak:snapshot.activeBreak};});}
  static async updateBreak(userId:string,id:string,input:{breakType:string;startedAt:string;endedAt:string|null;note?:string|null}):Promise<AttendanceSnapshot>{return withTransaction(async db=>{await AttendanceRepository.lockUser(db,userId);const item=await AttendanceRepository.findOwnedBreak(db,userId,id);if(!item)throw new AppError(404,"BREAK_NOT_FOUND","Khong tim thay phien nghi");const start=new Date(input.startedAt),end=input.endedAt?new Date(input.endedAt):null;if(start<=item.check_in_at||(item.check_out_at&&(!end||end>item.check_out_at)))throw new AppError(400,"BREAK_OUTSIDE_SESSION","Phien nghi phai nam trong phien lam viec");if(await AttendanceRepository.hasBreakOverlap(db,item.attendance_session_id,start,end,id))throw new AppError(409,"BREAK_OVERLAP","Phien nghi bi trung thoi gian");await AttendanceRepository.updateBreak(db,id,{breakType:input.breakType,startedAt:start,endedAt:end,note:input.note??null});await AttendanceRepository.recalculateDayStatus(db,item.attendance_day_id);return buildSnapshot(db,userId,item.work_date);});}
  static async deleteBreak(userId:string,id:string):Promise<void>{await withTransaction(async db=>{await AttendanceRepository.lockUser(db,userId);const item=await AttendanceRepository.findOwnedBreak(db,userId,id);if(!item)throw new AppError(404,"BREAK_NOT_FOUND","Khong tim thay phien nghi");await AttendanceRepository.deleteBreak(db,id);await AttendanceRepository.recalculateDayStatus(db,item.attendance_day_id);});}

  static async createManualSession(userId:string,input:{checkInAt:string;checkOutAt:string|null;shiftId?:string|null;note?:string|null}):Promise<AttendanceSnapshot>{return withTransaction(async db=>{await AttendanceRepository.lockUser(db,userId);const start=new Date(input.checkInAt);const end=input.checkOutAt?new Date(input.checkOutAt):null;if(await AttendanceRepository.hasOverlap(db,userId,start,end,null))throw new AppError(409,"ATTENDANCE_SESSION_OVERLAP","Phien lam viec bi trung thoi gian");if(input.shiftId&&!(await AttendanceRepository.verifyShift(db,userId,input.shiftId)))throw new AppError(400,"WORK_SHIFT_INVALID","Ca lam khong hop le");const context=await AttendanceRepository.getContext(db,userId,null,start);if(!context)throw new AppError(404,"USER_SETTINGS_NOT_FOUND","Khong tim thay cau hinh");const day=await AttendanceRepository.getOrCreateDay(db,userId,context);const session=await AttendanceRepository.createSession(db,day.id,{at:start,source:"manual",shiftId:input.shiftId,note:input.note??undefined});if(end)await AttendanceRepository.closeSession(db,session.id,end,"manual",undefined,undefined,input.note??undefined);await AttendanceRepository.recalculateDayStatus(db,day.id);return buildSnapshot(db,userId,context.work_date);});}

  static async updateSession(userId:string,id:string,input:{checkInAt:string;checkOutAt:string|null;shiftId?:string|null;note?:string|null}):Promise<AttendanceSnapshot>{return withTransaction(async db=>{await AttendanceRepository.lockUser(db,userId);const session=await AttendanceRepository.findOwnedSession(db,userId,id);if(!session||!session.attendance_day_id||!session.work_date)throw new AppError(404,"ATTENDANCE_SESSION_NOT_FOUND","Khong tim thay phien cham cong");const start=new Date(input.checkInAt);const end=input.checkOutAt?new Date(input.checkOutAt):null;if(await AttendanceRepository.hasOverlap(db,userId,start,end,id))throw new AppError(409,"ATTENDANCE_SESSION_OVERLAP","Phien lam viec bi trung thoi gian");if(input.shiftId&&!(await AttendanceRepository.verifyShift(db,userId,input.shiftId)))throw new AppError(400,"WORK_SHIFT_INVALID","Ca lam khong hop le");await AttendanceRepository.updateManualSession(db,id,start,end,input.shiftId??null,input.note??null);await AttendanceRepository.recalculateDayStatus(db,session.attendance_day_id);await AttendanceRepository.audit(db,userId,"attendance_session",id,"update",input,crypto.randomUUID());return buildSnapshot(db,userId,session.work_date);});}

  static async deleteSession(userId:string,id:string):Promise<void>{await withTransaction(async db=>{await AttendanceRepository.lockUser(db,userId);const session=await AttendanceRepository.findOwnedSession(db,userId,id);if(!session||!session.attendance_day_id)throw new AppError(404,"ATTENDANCE_SESSION_NOT_FOUND","Khong tim thay phien cham cong");await AttendanceRepository.deleteSession(db,id);await AttendanceRepository.recalculateDayStatus(db,session.attendance_day_id);});}

  static async cancelLatest(userId:string):Promise<AttendanceSnapshot>{return withTransaction(async db=>{await AttendanceRepository.lockUser(db,userId);const session=await AttendanceRepository.latestSession(db,userId);if(!session||!session.attendance_day_id||!session.work_date)throw new AppError(409,"NO_ATTENDANCE_TO_CANCEL","Khong co ban ghi de huy");await AttendanceRepository.deleteSession(db,session.id);await AttendanceRepository.recalculateDayStatus(db,session.attendance_day_id);return buildSnapshot(db,userId,session.work_date);});}

  static async resolveForgottenCheckout(userId:string,input:{checkOutAt:string;note?:string|null}):Promise<AttendanceSnapshot>{return withTransaction(async db=>{await AttendanceRepository.lockUser(db,userId);const session=await AttendanceRepository.findActiveSession(db,userId);if(!session||!session.attendance_day_id||!session.work_date)throw new AppError(409,"NO_ACTIVE_SESSION","Khong co phien quen cham ra");const end=new Date(input.checkOutAt);if(end<=session.check_in_at)throw new AppError(400,"CHECK_OUT_BEFORE_CHECK_IN","Gio ra phai sau gio vao");await AttendanceRepository.closeSession(db,session.id,end,"manual",undefined,undefined,input.note??undefined);await AttendanceRepository.recalculateDayStatus(db,session.attendance_day_id);return buildSnapshot(db,userId,session.work_date);});}
  static getToday(userId: string): Promise<AttendanceSnapshot> {
    return buildSnapshot(getPool(), userId, null);
  }

  static getByDate(userId: string, workDate: string): Promise<AttendanceSnapshot> {
    return buildSnapshot(getPool(), userId, workDate);
  }

  static async checkIn(userId: string, input: CheckInInput): Promise<AttendanceSnapshot> {
    return withTransaction(async (db) => {
      const replay = await beginIdempotent(db, userId, "attendance.check_in", input);
      if (replay) return replay;
      if (await AttendanceRepository.findActiveSession(db, userId)) {
        throw new AppError(409, "SESSION_ALREADY_ACTIVE", "Ban dang co mot ca lam chua ket thuc");
      }
      const at = resolveEventTime(input);
      const context = await AttendanceRepository.getContext(db, userId, null, at);
      if (!context) throw new AppError(404, "USER_SETTINGS_NOT_FOUND", "Khong tim thay cau hinh nguoi dung");
      validateCheckInWindow(context, at);
      if (input.shiftId && !(await AttendanceRepository.verifyShift(db, userId, input.shiftId))) {
        throw new AppError(400, "WORK_SHIFT_INVALID", "Ca lam khong hop le hoac da bi tat");
      }
      const day = await AttendanceRepository.getOrCreateDay(db, userId, context);
      const session = await AttendanceRepository.createSession(db, day.id, {
        at,
        source: input.source,
        note: input.note,
        shiftId: input.shiftId,
        localTimestamp: input.localTimestamp,
        deviceId: input.deviceId,
      });
      await AttendanceRepository.setDayStatus(db, day.id, "working");
      await AttendanceRepository.audit(db, userId, "attendance_session", session.id, "create", session, input.clientRequestId);
      const snapshot = await buildSnapshot(db, userId, context.work_date);
      return completeIdempotent(db, userId, "attendance.check_in", input, snapshot, "attendance_session", session.id);
    });
  }

  static async checkOut(userId: string, input: CheckOutInput): Promise<AttendanceSnapshot> {
    return withTransaction(async (db) => {
      const replay = await beginIdempotent(db, userId, "attendance.check_out", input);
      if (replay) return replay;
      const session = await AttendanceRepository.findActiveSession(db, userId);
      if (!session || !session.attendance_day_id || !session.work_date) {
        throw new AppError(409, "NO_ACTIVE_SESSION", "Khong co ca lam dang hoat dong");
      }
      const at = resolveEventTime(input);
      if (at.getTime() <= session.check_in_at.getTime()) {
        throw new AppError(400, "CHECK_OUT_BEFORE_CHECK_IN", "Gio ra phai sau gio vao");
      }
      const context = await AttendanceRepository.getContext(db, userId, session.work_date);
      if (!context) throw new AppError(404, "USER_SETTINGS_NOT_FOUND", "Khong tim thay cau hinh nguoi dung");
      const activeBreak = await AttendanceRepository.findActiveBreak(db, session.id);
      if (activeBreak) {
        if (context.checkout_open_break_policy === "require_end") {
          throw new AppError(409, "BREAK_STILL_ACTIVE", "Hay ket thuc nghi giai lao truoc khi cham ra");
        }
        if (at.getTime() <= activeBreak.started_at.getTime()) {
          throw new AppError(400, "BREAK_END_INVALID", "Gio ket thuc nghi khong hop le");
        }
        await AttendanceRepository.endBreak(db, activeBreak.id, at);
      }
      await AttendanceRepository.closeSession(
        db,
        session.id,
        at,
        input.source,
        input.localTimestamp,
        input.deviceId,
        input.note,
      );
      await AttendanceRepository.setDayStatus(db, session.attendance_day_id, "completed");
      await AttendanceRepository.audit(db, userId, "attendance_session", session.id, "update", { checkOutAt: at }, input.clientRequestId);
      const snapshot = await buildSnapshot(db, userId, session.work_date);
      return completeIdempotent(db, userId, "attendance.check_out", input, snapshot, "attendance_session", session.id);
    });
  }

  static async startBreak(userId: string, input: BreakStartInput): Promise<AttendanceSnapshot> {
    return withTransaction(async (db) => {
      const replay = await beginIdempotent(db, userId, "break.start", input);
      if (replay) return replay;
      const session = await AttendanceRepository.findActiveSession(db, userId);
      if (!session || !session.attendance_day_id || !session.work_date) {
        throw new AppError(409, "NO_ACTIVE_SESSION", "Can cham vao truoc khi nghi giai lao");
      }
      if (await AttendanceRepository.findActiveBreak(db, session.id)) {
        throw new AppError(409, "BREAK_ALREADY_ACTIVE", "Ban dang trong thoi gian nghi giai lao");
      }
      const at = resolveEventTime(input);
      if (at.getTime() <= session.check_in_at.getTime()) {
        throw new AppError(400, "BREAK_BEFORE_CHECK_IN", "Gio bat dau nghi phai sau gio vao");
      }
      const breakSession = await AttendanceRepository.createBreak(db, session.id, at, input.breakType, input.note);
      await AttendanceRepository.setDayStatus(db, session.attendance_day_id, "on_break");
      await AttendanceRepository.audit(db, userId, "break_session", breakSession.id, "create", breakSession, input.clientRequestId);
      const snapshot = await buildSnapshot(db, userId, session.work_date);
      return completeIdempotent(db, userId, "break.start", input, snapshot, "break_session", breakSession.id);
    });
  }

  static async endBreak(userId: string, input: BreakEndInput): Promise<AttendanceSnapshot> {
    return withTransaction(async (db) => {
      const replay = await beginIdempotent(db, userId, "break.end", input);
      if (replay) return replay;
      const session = await AttendanceRepository.findActiveSession(db, userId);
      if (!session || !session.attendance_day_id || !session.work_date) {
        throw new AppError(409, "NO_ACTIVE_SESSION", "Khong co ca lam dang hoat dong");
      }
      const activeBreak = await AttendanceRepository.findActiveBreak(db, session.id);
      if (!activeBreak) throw new AppError(409, "NO_ACTIVE_BREAK", "Khong co phien nghi dang hoat dong");
      const at = resolveEventTime(input);
      if (at.getTime() <= activeBreak.started_at.getTime()) {
        throw new AppError(400, "BREAK_END_INVALID", "Gio ket thuc nghi phai sau gio bat dau");
      }
      await AttendanceRepository.endBreak(db, activeBreak.id, at, input.note);
      await AttendanceRepository.setDayStatus(db, session.attendance_day_id, "working");
      await AttendanceRepository.audit(db, userId, "break_session", activeBreak.id, "update", { endedAt: at }, input.clientRequestId);
      const snapshot = await buildSnapshot(db, userId, session.work_date);
      return completeIdempotent(db, userId, "break.end", input, snapshot, "break_session", activeBreak.id);
    });
  }
}
