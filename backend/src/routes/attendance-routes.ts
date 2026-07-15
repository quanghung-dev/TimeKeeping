import { Router } from "express";
import { z } from "zod";
import {
  attendanceDateSchema,
  attendanceRangeSchema,
  attendanceSessionIdSchema,
  breakEndSchema,
  breakStartSchema,
  checkInSchema,
  checkOutSchema,
  manualSessionSchema,
  forgottenCheckoutSchema,
  breakIdSchema,
  breakUpdateSchema,
} from "../application/validators/attendance-schemas.js";
import { asyncHandler } from "../common/middleware/async-handler.js";
import { requireAuth } from "../common/middleware/auth.js";
import { csrfProtection } from "../common/middleware/csrf.js";
import { validateParams } from "../common/middleware/validate-params.js";
import { validateQuery } from "../common/middleware/validate-query.js";
import { validateBody } from "../common/middleware/validate.js";
import { AttendanceController } from "../controllers/attendance-controller.js";

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);
attendanceRouter.get("/attendance/today", asyncHandler(AttendanceController.today));
attendanceRouter.get("/attendance/active-session", asyncHandler(AttendanceController.active));
attendanceRouter.get("/attendance/daily",validateQuery(attendanceRangeSchema),asyncHandler(AttendanceController.daily));
attendanceRouter.get("/breaks/active",asyncHandler(AttendanceController.breakActive));
attendanceRouter.get("/breaks/daily",validateQuery(z.object({date:z.iso.date()})),asyncHandler(AttendanceController.breaksDaily));
attendanceRouter.get(
  "/attendance/days/:date",
  validateParams(attendanceDateSchema),
  asyncHandler(AttendanceController.byDate),
);
attendanceRouter.post(
  "/attendance/check-in",
  csrfProtection,
  validateBody(checkInSchema),
  asyncHandler(AttendanceController.checkIn),
);
attendanceRouter.post("/attendance/sessions",csrfProtection,validateBody(manualSessionSchema),asyncHandler(AttendanceController.createSession));
attendanceRouter.put("/attendance/sessions/:id",csrfProtection,validateParams(attendanceSessionIdSchema),validateBody(manualSessionSchema),asyncHandler(AttendanceController.updateSession));
attendanceRouter.delete("/attendance/sessions/:id",csrfProtection,validateParams(attendanceSessionIdSchema),asyncHandler(AttendanceController.deleteSession));
attendanceRouter.post("/attendance/cancel-latest",csrfProtection,asyncHandler(AttendanceController.cancelLatest));
attendanceRouter.post("/attendance/resolve-forgotten-checkout",csrfProtection,validateBody(forgottenCheckoutSchema),asyncHandler(AttendanceController.resolveForgotten));
attendanceRouter.put("/breaks/:id",csrfProtection,validateParams(breakIdSchema),validateBody(breakUpdateSchema),asyncHandler(AttendanceController.updateBreak));
attendanceRouter.delete("/breaks/:id",csrfProtection,validateParams(breakIdSchema),asyncHandler(AttendanceController.deleteBreak));
attendanceRouter.post(
  "/attendance/check-out",
  csrfProtection,
  validateBody(checkOutSchema),
  asyncHandler(AttendanceController.checkOut),
);
attendanceRouter.post(
  "/breaks/start",
  csrfProtection,
  validateBody(breakStartSchema),
  asyncHandler(AttendanceController.startBreak),
);
attendanceRouter.post(
  "/breaks/end",
  csrfProtection,
  validateBody(breakEndSchema),
  asyncHandler(AttendanceController.endBreak),
);
