import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { AppError } from "../../common/errors/app-error.js";
import { getPool } from "../../infrastructure/database/pool.js";
import { withTransaction } from "../../infrastructure/database/transaction.js";
import { UserRepository } from "../../infrastructure/repositories/user-repository.js";
import { ReportService } from "./report-service.js";

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function backupRows(data: Record<string, unknown>, key: string): string {
  return JSON.stringify(Array.isArray(data[key]) ? data[key] : []);
}

export class DataExportService {
  static async report(userId: string, start: string, end: string, format: "csv" | "xlsx" | "pdf") {
    const report = await ReportService.range(userId, start, end);
    if (format === "csv") {
      const header = ["work_date", "status", "actual_minutes", "standard_minutes", "missing_minutes", "overtime_minutes", "late_minutes", "early_minutes"];
      const lines = [header.join(","), ...report.items.map((item) => [item.workDate, item.status, item.actualMinutes, item.standardMinutes, item.missingMinutes, item.overtimeMinutes, item.lateMinutes, item.earlyMinutes].map(csvCell).join(","))];
      return { content: Buffer.from(`\uFEFF${lines.join("\n")}`), contentType: "text/csv; charset=utf-8", extension: "csv" };
    }
    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Cham cong");
      sheet.columns = [{ header: "Ngày", key: "workDate", width: 14 }, { header: "Trạng thái", key: "status", width: 18 }, { header: "Phút làm", key: "actualMinutes", width: 14 }, { header: "Phút chuẩn", key: "standardMinutes", width: 14 }, { header: "Thiếu", key: "missingMinutes", width: 12 }, { header: "Làm thêm", key: "overtimeMinutes", width: 12 }];
      sheet.addRows(report.items);
      sheet.getRow(1).font = { bold: true };
      return { content: Buffer.from(await workbook.xlsx.writeBuffer()), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" };
    }
    const document = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    document.on("data", (chunk) => chunks.push(chunk as Buffer));
    const done = new Promise<Buffer>((resolve) => document.on("end", () => resolve(Buffer.concat(chunks))));
    document.fontSize(18).text("TIMEKEEPING REPORT");
    document.fontSize(10).text(`${start} - ${end}`);
    document.moveDown();
    for (const item of report.items) document.text(`${item.workDate} | ${item.status} | ${item.actualMinutes} min | overtime ${item.overtimeMinutes} min`);
    document.end();
    return { content: await done, contentType: "application/pdf", extension: "pdf" };
  }

  static async backup(userId: string) {
    const queries: Record<string, string> = {
      profile: `SELECT id,email,display_name,timezone,company,job_title FROM users WHERE id=$1`,
      settings: `SELECT * FROM user_settings WHERE user_id=$1`,
      schedules: `SELECT * FROM work_schedules WHERE user_id=$1`,
      shifts: `SELECT * FROM work_shifts WHERE user_id=$1`,
      scheduleShifts: `SELECT ws.day_of_week,sh.name AS shift_name,wss.sort_order FROM work_schedule_shifts wss JOIN work_schedules ws ON ws.id=wss.work_schedule_id JOIN work_shifts sh ON sh.id=wss.work_shift_id WHERE ws.user_id=$1`,
      attendanceDays: `SELECT * FROM attendance_days WHERE user_id=$1`,
      attendanceSessions: `SELECT s.* FROM attendance_sessions s JOIN attendance_days d ON d.id=s.attendance_day_id WHERE d.user_id=$1`,
      breakSessions: `SELECT b.* FROM break_sessions b JOIN attendance_sessions s ON s.id=b.attendance_session_id JOIN attendance_days d ON d.id=s.attendance_day_id WHERE d.user_id=$1`,
      leaves: `SELECT * FROM leave_days WHERE user_id=$1`, holidays: `SELECT * FROM holidays WHERE user_id=$1`, leaveBalances: `SELECT * FROM leave_balances WHERE user_id=$1`,
      calendarEvents: `SELECT * FROM calendar_events WHERE user_id=$1`, overtime: `SELECT * FROM overtime_sessions WHERE user_id=$1`,
      projects: `SELECT * FROM projects WHERE user_id=$1`, tasks: `SELECT * FROM tasks WHERE user_id=$1`, taskEntries: `SELECT * FROM task_time_entries WHERE user_id=$1`, journals: `SELECT * FROM daily_notes WHERE user_id=$1`,
      salarySettings: `SELECT * FROM salary_settings WHERE user_id=$1`, adjustments: `SELECT * FROM payroll_adjustments WHERE user_id=$1`, payrollSnapshots: `SELECT * FROM payroll_snapshots WHERE user_id=$1`,
      notificationSettings: `SELECT * FROM notification_settings WHERE user_id=$1`, notifications: `SELECT * FROM notifications WHERE user_id=$1`,
    };
    const entries = await Promise.all(Object.entries(queries).map(async ([key, sql]) => [key, (await getPool().query(sql, [userId])).rows] as const));
    return { version: 1, exportedAt: new Date().toISOString(), data: Object.fromEntries(entries) };
  }

  static async restore(userId: string, backup: unknown) {
    if (!backup || typeof backup !== "object" || !("version" in backup) || (backup as { version: unknown }).version !== 1 || !("data" in backup)) throw new AppError(400, "BACKUP_INVALID", "File sao luu khong hop le");
    const data = (backup as { data: Record<string, unknown> }).data;
    await withTransaction(async (db) => {
      await db.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [userId]);
      await db.query(`UPDATE users u SET display_name=x.display_name,timezone=x.timezone,company=x.company,job_title=x.job_title FROM json_to_recordset($2::json) x(display_name text,timezone text,company text,job_title text) WHERE u.id=$1`, [userId, backupRows(data, "profile")]);
      await db.query(`UPDATE user_settings s SET time_format=x.time_format,week_starts_on=x.week_starts_on,late_grace_minutes=x.late_grace_minutes,early_leave_grace_minutes=x.early_leave_grace_minutes,overtime_after_minutes=x.overtime_after_minutes,rounding_minutes=x.rounding_minutes,auto_detect_overtime=x.auto_detect_overtime,auto_deduct_break=x.auto_deduct_break,currency=x.currency,language=x.language,theme_mode=x.theme_mode,accent_color=x.accent_color,schedule_mode=x.schedule_mode,earliest_check_in_minutes=x.earliest_check_in_minutes,latest_check_in_minutes=x.latest_check_in_minutes,standard_work_days_per_month=x.standard_work_days_per_month,checkout_open_break_policy=x.checkout_open_break_policy,max_session_minutes=x.max_session_minutes,overtime_rule=x.overtime_rule FROM json_to_recordset($2::json) x(time_format text,week_starts_on smallint,late_grace_minutes int,early_leave_grace_minutes int,overtime_after_minutes int,rounding_minutes int,auto_detect_overtime boolean,auto_deduct_break boolean,currency text,language text,theme_mode text,accent_color text,schedule_mode text,earliest_check_in_minutes int,latest_check_in_minutes int,standard_work_days_per_month numeric,checkout_open_break_policy text,max_session_minutes int,overtime_rule text) WHERE s.user_id=$1`, [userId, backupRows(data, "settings")]);
      await db.query(`INSERT INTO projects(id,user_id,name,color,description,is_archived) SELECT x.id,$1,x.name,x.color,x.description,x.is_archived FROM json_to_recordset($2::json) x(id uuid,name text,color text,description text,is_archived boolean) ON CONFLICT(id) DO NOTHING`, [userId, backupRows(data, "projects")]);
      await db.query(`INSERT INTO work_shifts(id,user_id,name,color,start_time,end_time,standard_minutes,default_break_minutes,is_active) SELECT x.id,$1,x.name,x.color,x.start_time,x.end_time,x.standard_minutes,x.default_break_minutes,x.is_active FROM json_to_recordset($2::json) x(id uuid,name text,color text,start_time time,end_time time,standard_minutes int,default_break_minutes int,is_active boolean) ON CONFLICT(id) DO NOTHING`, [userId, backupRows(data, "shifts")]);
      await db.query(`INSERT INTO work_schedules(id,user_id,day_of_week,is_working_day,start_time,end_time,standard_minutes,default_break_minutes) SELECT x.id,$1,x.day_of_week,x.is_working_day,x.start_time,x.end_time,x.standard_minutes,x.default_break_minutes FROM json_to_recordset($2::json) x(id uuid,day_of_week smallint,is_working_day boolean,start_time time,end_time time,standard_minutes int,default_break_minutes int) ON CONFLICT(user_id,day_of_week) DO UPDATE SET is_working_day=EXCLUDED.is_working_day,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time,standard_minutes=EXCLUDED.standard_minutes,default_break_minutes=EXCLUDED.default_break_minutes`, [userId, backupRows(data, "schedules")]);
      await db.query(`INSERT INTO work_schedule_shifts(work_schedule_id,work_shift_id,sort_order) SELECT ws.id,sh.id,x.sort_order FROM json_to_recordset($2::json) x(day_of_week smallint,shift_name text,sort_order smallint) JOIN work_schedules ws ON ws.user_id=$1 AND ws.day_of_week=x.day_of_week JOIN work_shifts sh ON sh.user_id=$1 AND sh.name=x.shift_name ON CONFLICT DO NOTHING`, [userId, backupRows(data, "scheduleShifts")]);
      await db.query(`INSERT INTO attendance_days(id,user_id,work_date,status,manual_adjustment_minutes,note) SELECT x.id,$1,x.work_date,x.status,x.manual_adjustment_minutes,x.note FROM json_to_recordset($2::json) x(id uuid,work_date date,status text,manual_adjustment_minutes int,note text) ON CONFLICT(user_id,work_date) DO UPDATE SET status=EXCLUDED.status,manual_adjustment_minutes=EXCLUDED.manual_adjustment_minutes,note=EXCLUDED.note`, [userId, backupRows(data, "attendanceDays")]);
      await db.query(`INSERT INTO attendance_sessions(id,attendance_day_id,check_in_at,check_out_at,check_in_source,check_out_source,note,client_recorded_at,device_id) SELECT s.id,d.id,s.check_in_at,s.check_out_at,s.check_in_source,s.check_out_source,s.note,s.client_recorded_at,s.device_id FROM json_to_recordset($2::json) s(id uuid,attendance_day_id uuid,check_in_at timestamptz,check_out_at timestamptz,check_in_source text,check_out_source text,note text,client_recorded_at timestamptz,device_id text) JOIN json_to_recordset($3::json) bd(id uuid,work_date date) ON bd.id=s.attendance_day_id JOIN attendance_days d ON d.user_id=$1 AND d.work_date=bd.work_date ON CONFLICT(id) DO NOTHING`, [userId, backupRows(data, "attendanceSessions"), backupRows(data, "attendanceDays")]);
      await db.query(`INSERT INTO break_sessions(id,attendance_session_id,break_type,started_at,ended_at,note) SELECT x.id,x.attendance_session_id,x.break_type,x.started_at,x.ended_at,x.note FROM json_to_recordset($2::json) x(id uuid,attendance_session_id uuid,break_type text,started_at timestamptz,ended_at timestamptz,note text) JOIN attendance_sessions s ON s.id=x.attendance_session_id JOIN attendance_days d ON d.id=s.attendance_day_id AND d.user_id=$1 ON CONFLICT(id) DO NOTHING`, [userId, backupRows(data, "breakSessions")]);
      await db.query(`INSERT INTO leave_days(id,user_id,leave_date,leave_type,leave_period,duration_minutes,reason) SELECT x.id,$1,x.leave_date,x.leave_type,x.leave_period,x.duration_minutes,x.reason FROM json_to_recordset($2::json) x(id uuid,leave_date date,leave_type text,leave_period text,duration_minutes int,reason text) ON CONFLICT(user_id,leave_date) DO UPDATE SET leave_type=EXCLUDED.leave_type,leave_period=EXCLUDED.leave_period,duration_minutes=EXCLUDED.duration_minutes,reason=EXCLUDED.reason`, [userId, backupRows(data, "leaves")]);
      await db.query(`INSERT INTO holidays(id,user_id,holiday_date,name,is_paid,note) SELECT x.id,$1,x.holiday_date,x.name,x.is_paid,x.note FROM json_to_recordset($2::json) x(id uuid,holiday_date date,name text,is_paid boolean,note text) ON CONFLICT(user_id,holiday_date) DO UPDATE SET name=EXCLUDED.name,is_paid=EXCLUDED.is_paid,note=EXCLUDED.note`, [userId, backupRows(data, "holidays")]);
      await db.query(`INSERT INTO leave_balances(user_id,balance_year,allowance_minutes,carried_minutes) SELECT $1,x.balance_year,x.allowance_minutes,x.carried_minutes FROM json_to_recordset($2::json) x(balance_year int,allowance_minutes int,carried_minutes int) ON CONFLICT(user_id,balance_year) DO UPDATE SET allowance_minutes=EXCLUDED.allowance_minutes,carried_minutes=EXCLUDED.carried_minutes`, [userId, backupRows(data, "leaveBalances")]);
      await db.query(`INSERT INTO calendar_events(id,user_id,title,event_type,starts_at,ends_at,is_all_day,recurrence_rule,note) SELECT x.id,$1,x.title,x.event_type,x.starts_at,x.ends_at,x.is_all_day,x.recurrence_rule,x.note FROM json_to_recordset($2::json) x(id uuid,title text,event_type text,starts_at timestamptz,ends_at timestamptz,is_all_day boolean,recurrence_rule text,note text) ON CONFLICT(id) DO NOTHING`, [userId, backupRows(data, "calendarEvents")]);
      await db.query(`INSERT INTO overtime_sessions(id,user_id,started_at,ended_at,overtime_type,multiplier,source,note) SELECT x.id,$1,x.started_at,x.ended_at,x.overtime_type,x.multiplier,x.source,x.note FROM json_to_recordset($2::json) x(id uuid,started_at timestamptz,ended_at timestamptz,overtime_type text,multiplier numeric,source text,note text) ON CONFLICT(id) DO NOTHING`, [userId, backupRows(data, "overtime")]);
      await db.query(`INSERT INTO tasks(id,user_id,project_id,title,description,task_date,priority,status,estimated_minutes,completed_at) SELECT x.id,$1,p.id,x.title,x.description,x.task_date,x.priority,x.status,x.estimated_minutes,x.completed_at FROM json_to_recordset($2::json) x(id uuid,project_id uuid,title text,description text,task_date date,priority text,status text,estimated_minutes int,completed_at timestamptz) LEFT JOIN projects p ON p.id=x.project_id AND p.user_id=$1 ON CONFLICT(id) DO NOTHING`, [userId, backupRows(data, "tasks")]);
      await db.query(`INSERT INTO task_time_entries(id,user_id,task_id,entry_type,started_at,ended_at,note) SELECT x.id,$1,t.id,x.entry_type,x.started_at,x.ended_at,x.note FROM json_to_recordset($2::json) x(id uuid,task_id uuid,entry_type text,started_at timestamptz,ended_at timestamptz,note text) JOIN tasks t ON t.id=x.task_id AND t.user_id=$1 ON CONFLICT(id) DO NOTHING`, [userId, backupRows(data, "taskEntries")]);
      await db.query(`INSERT INTO daily_notes(id,user_id,note_date,work_summary,next_day_plan,productivity_score) SELECT x.id,$1,x.note_date,x.work_summary,x.next_day_plan,x.productivity_score FROM json_to_recordset($2::json) x(id uuid,note_date date,work_summary text,next_day_plan text,productivity_score smallint) ON CONFLICT(user_id,note_date) DO UPDATE SET work_summary=EXCLUDED.work_summary,next_day_plan=EXCLUDED.next_day_plan,productivity_score=EXCLUDED.productivity_score`, [userId, backupRows(data, "journals")]);
      await db.query(`INSERT INTO salary_settings(id,user_id,salary_type,base_salary,hourly_rate,daily_rate,weekday_overtime_multiplier,weekend_overtime_multiplier,holiday_overtime_multiplier,effective_from,effective_to) SELECT x.id,$1,x.salary_type,x.base_salary,x.hourly_rate,x.daily_rate,x.weekday_overtime_multiplier,x.weekend_overtime_multiplier,x.holiday_overtime_multiplier,x.effective_from,x.effective_to FROM json_to_recordset($2::json) x(id uuid,salary_type text,base_salary numeric,hourly_rate numeric,daily_rate numeric,weekday_overtime_multiplier numeric,weekend_overtime_multiplier numeric,holiday_overtime_multiplier numeric,effective_from date,effective_to date) ON CONFLICT(id) DO NOTHING`, [userId, backupRows(data, "salarySettings")]);
      await db.query(`INSERT INTO payroll_adjustments(id,user_id,adjustment_date,adjustment_type,category,amount,note) SELECT x.id,$1,x.adjustment_date,x.adjustment_type,x.category,x.amount,x.note FROM json_to_recordset($2::json) x(id uuid,adjustment_date date,adjustment_type text,category text,amount numeric,note text) ON CONFLICT(id) DO NOTHING`, [userId, backupRows(data, "adjustments")]);
      await db.query(`INSERT INTO payroll_snapshots(id,user_id,payroll_year,payroll_month,currency,gross_amount,overtime_amount,allowance_amount,deduction_amount,net_amount,calculation) SELECT x.id,$1,x.payroll_year,x.payroll_month,x.currency,x.gross_amount,x.overtime_amount,x.allowance_amount,x.deduction_amount,x.net_amount,x.calculation FROM json_to_recordset($2::json) x(id uuid,payroll_year int,payroll_month smallint,currency text,gross_amount numeric,overtime_amount numeric,allowance_amount numeric,deduction_amount numeric,net_amount numeric,calculation jsonb) ON CONFLICT(user_id,payroll_year,payroll_month) DO NOTHING`, [userId, backupRows(data, "payrollSnapshots")]);
      await db.query(`INSERT INTO notification_settings(user_id,check_in_reminder,check_out_reminder,break_reminder,missing_time_reminder,daily_summary,weekly_summary,browser_enabled,email_enabled) SELECT $1,x.check_in_reminder,x.check_out_reminder,x.break_reminder,x.missing_time_reminder,x.daily_summary,x.weekly_summary,x.browser_enabled,x.email_enabled FROM json_to_recordset($2::json) x(check_in_reminder boolean,check_out_reminder boolean,break_reminder boolean,missing_time_reminder boolean,daily_summary boolean,weekly_summary boolean,browser_enabled boolean,email_enabled boolean) ON CONFLICT(user_id) DO UPDATE SET check_in_reminder=EXCLUDED.check_in_reminder,check_out_reminder=EXCLUDED.check_out_reminder,break_reminder=EXCLUDED.break_reminder,missing_time_reminder=EXCLUDED.missing_time_reminder,daily_summary=EXCLUDED.daily_summary,weekly_summary=EXCLUDED.weekly_summary,browser_enabled=EXCLUDED.browser_enabled,email_enabled=EXCLUDED.email_enabled`, [userId, backupRows(data, "notificationSettings")]);
      await db.query(`INSERT INTO audit_logs(user_id,entity_type,entity_id,action,after_data) VALUES($1,'backup',$1,'restore',jsonb_build_object('version',1))`, [userId]);
    });
    return { restored: true };
  }

  static async deletePersonalData(userId: string, password: string) {
    await withTransaction(async (db) => {
      await db.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [userId]);
      const user = await db.query<{ password_hash: string | null }>(`SELECT password_hash FROM users WHERE id=$1 FOR UPDATE`, [userId]);
      const hash = user.rows[0]?.password_hash;
      if (!hash || !(await bcrypt.compare(password, hash))) throw new AppError(400, "PASSWORD_INVALID", "Mat khau hien tai khong dung");
      const tables = ["task_time_entries", "tasks", "projects", "payroll_snapshots", "payroll_adjustments", "salary_settings", "notifications", "push_subscriptions", "notification_settings", "leave_balances", "daily_notes", "calendar_events", "overtime_sessions", "leave_days", "holidays", "attendance_days", "idempotency_keys", "audit_logs", "work_shifts", "work_schedules", "user_avatars", "user_settings"] as const;
      for (const table of tables) await db.query(`DELETE FROM ${table} WHERE user_id=$1`, [userId]);
      await db.query(`UPDATE users SET company=NULL,job_title=NULL,updated_at=NOW() WHERE id=$1`, [userId]);
      await UserRepository.createDefaults(db, userId);
    });
    return { deleted: true };
  }
}
