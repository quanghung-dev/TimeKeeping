import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { LeaveRepository } from "../src/infrastructure/repositories/leave-repository.js";

describe("LeaveRepository.clearAttendanceLeave database sync cases", () => {
  const runTest = async (userId: string, date: string) => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
    } as unknown as PoolClient;

    await LeaveRepository.clearAttendanceLeave(mockClient, userId, date);
    return (mockClient.query as any).mock.calls[0];
  };

  it("1. Xóa nghỉ phép khi schedule_id có giá trị - Cập nhật chính xác và gán lại schedule_id bằng truy vấn", async () => {
    const [sql, params] = await runTest("user-1", "2026-07-15");
    expect(sql).toContain("schedule_id = (SELECT ws.id");
    expect(params).toEqual(["user-1", "2026-07-15"]);
  });

  it("2. Xóa nghỉ phép khi schedule_id là NULL - Vẫn cập nhật bình thường nhờ truy vấn theo day_of_week", async () => {
    const [sql, params] = await runTest("user-1", "2026-07-15");
    expect(sql).not.toContain("ws.id = d.schedule_id"); // Không dùng join cứng schedule_id nữa
    expect(params).toEqual(["user-1", "2026-07-15"]);
  });

  it("3. Xóa nghỉ phép tại ngày làm việc chưa chấm công - CASE WHEN trả về 'not_started'", async () => {
    const [sql] = await runTest("user-1", "2026-07-15");
    expect(sql).toContain("WHEN COALESCE((SELECT ws.is_working_day");
    expect(sql).toContain("THEN 'not_started'");
  });

  it("4. Xóa nghỉ phép tại ngày nghỉ - CASE WHEN trả về 'day_off' khi is_working_day là false", async () => {
    const [sql] = await runTest("user-1", "2026-07-15");
    expect(sql).toContain("ELSE 'day_off'");
  });

  it("5. Xóa nghỉ phép khi có session đã hoàn thành - CASE WHEN trả về 'completed'", async () => {
    const [sql] = await runTest("user-1", "2026-07-15");
    expect(sql).toContain("WHEN EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.attendance_day_id = d.id) THEN 'completed'");
  });

  it("6. Xóa nghỉ phép khi có session đang hoạt động - CASE WHEN trả về 'working'", async () => {
    const [sql] = await runTest("user-1", "2026-07-15");
    expect(sql).toContain("s.check_out_at IS NULL");
    expect(sql).toContain("THEN 'working'");
  });

  it("7. Work schedule cũ đã bị xóa bằng ON DELETE SET NULL - Vẫn tìm được lịch hiện tại và cập nhật", async () => {
    const [sql] = await runTest("user-1", "2026-07-15");
    expect(sql).toContain("ws.day_of_week = EXTRACT(ISODOW FROM d.work_date)::int");
  });

  it("8. Không được cập nhật dữ liệu của người dùng khác - Ràng buộc d.user_id = $1", async () => {
    const [sql, params] = await runTest("user-other", "2026-07-15");
    expect(sql).toContain("WHERE d.user_id = $1");
    expect(params[0]).toBe("user-other");
  });
});
