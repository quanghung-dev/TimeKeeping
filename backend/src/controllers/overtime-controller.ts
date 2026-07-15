import type { Request, Response } from "express";
import { OvertimeService } from "../application/services/overtime-service.js";
import type { OvertimeInput } from "../application/validators/overtime-schemas.js";
import { AppError } from "../common/errors/app-error.js";
import { requireUserId } from "../common/middleware/auth.js";
import { sendSuccess } from "../common/responses/api-response.js";

function id(request: Request): string { const value = request.params.id; if (typeof value !== "string") throw new AppError(400, "OVERTIME_ID_INVALID", "Ma lam them khong hop le"); return value; }
export class OvertimeController {
  static async list(request: Request, response: Response) { sendSuccess(response, await OvertimeService.list(requireUserId(request), String(request.query.start), String(request.query.end)), "Lay lam them thanh cong"); }
  static async active(request: Request, response: Response) { sendSuccess(response, await OvertimeService.active(requireUserId(request)), "Lay phien lam them thanh cong"); }
  static async start(request: Request, response: Response) { sendSuccess(response, await OvertimeService.start(requireUserId(request), request.body), "Bat dau lam them thanh cong", 201); }
  static async end(request: Request, response: Response) { sendSuccess(response, await OvertimeService.end(requireUserId(request), request.body.note), "Ket thuc lam them thanh cong"); }
  static async create(request: Request, response: Response) { sendSuccess(response, await OvertimeService.create(requireUserId(request), request.body as OvertimeInput), "Tao lam them thanh cong", 201); }
  static async update(request: Request, response: Response) { sendSuccess(response, await OvertimeService.update(requireUserId(request), id(request), request.body as OvertimeInput), "Cap nhat lam them thanh cong"); }
  static async delete(request: Request, response: Response) { await OvertimeService.delete(requireUserId(request), id(request)); response.status(204).send(); }
  static async summary(request: Request, response: Response) { sendSuccess(response, await OvertimeService.summary(requireUserId(request), String(request.query.start), String(request.query.end)), "Lay tong hop lam them thanh cong"); }
}
