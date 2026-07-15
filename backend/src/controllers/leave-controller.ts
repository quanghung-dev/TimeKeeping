import type { Request, Response } from "express";
import { LeaveService } from "../application/services/leave-service.js";
import type { LeaveInput, LeaveListQuery } from "../application/validators/leave-schemas.js";
import { AppError } from "../common/errors/app-error.js";
import { requireUserId } from "../common/middleware/auth.js";
import { sendSuccess } from "../common/responses/api-response.js";

export class LeaveController {
  static async list(request: Request, response: Response): Promise<void> {
    sendSuccess(response, await LeaveService.list(requireUserId(request), request.query as unknown as LeaveListQuery), "Lay danh sach ngay nghi thanh cong");
  }

  static async balance(request: Request, response: Response): Promise<void> {
    const year = Number(request.query.year);
    sendSuccess(response, await LeaveService.balance(requireUserId(request), year), "Lay so du phep thanh cong");
  }

  static async summary(request: Request, response: Response): Promise<void> {
    const userId = requireUserId(request);
    const year = Number(request.query.year);
    const [balance, list] = await Promise.all([
      LeaveService.balance(userId, year),
      LeaveService.list(userId, { year, page: 1, pageSize: 100 }),
    ]);
    sendSuccess(response, { balance, count: list.total, recent: list.items.slice(0, 5) }, "Lay tong hop ngay nghi thanh cong");
  }

  static async create(request: Request, response: Response): Promise<void> {
    sendSuccess(response, await LeaveService.create(requireUserId(request), request.body as LeaveInput), "Tao ngay nghi thanh cong", 201);
  }

  static async update(request: Request, response: Response): Promise<void> {
    const id = request.params.id;
    if (typeof id !== "string") throw new AppError(400, "LEAVE_ID_INVALID", "Ma ngay nghi khong hop le");
    sendSuccess(response, await LeaveService.update(requireUserId(request), id, request.body as LeaveInput), "Cap nhat ngay nghi thanh cong");
  }

  static async delete(request: Request, response: Response): Promise<void> {
    const id = request.params.id;
    if (typeof id !== "string") throw new AppError(400, "LEAVE_ID_INVALID", "Ma ngay nghi khong hop le");
    await LeaveService.delete(requireUserId(request), id);
    response.status(204).send();
  }
}
