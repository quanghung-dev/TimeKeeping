import type { Request, Response } from "express";
import type { UpdateWorkSettingsInput, WorkShiftInput } from "../application/validators/work-settings-schemas.js";
import { WorkSettingsService } from "../application/services/work-settings-service.js";
import { requireUserId } from "../common/middleware/auth.js";
import { AppError } from "../common/errors/app-error.js";
import { sendSuccess } from "../common/responses/api-response.js";

export class WorkSettingsController {
  static async get(request: Request, response: Response): Promise<void> {
    sendSuccess(response, await WorkSettingsService.get(requireUserId(request)), "Lay cau hinh lam viec thanh cong");
  }

  static async update(request: Request, response: Response): Promise<void> {
    const settings = await WorkSettingsService.update(requireUserId(request), request.body as UpdateWorkSettingsInput);
    sendSuccess(response, settings, "Cap nhat cau hinh lam viec thanh cong");
  }

  static async listShifts(request: Request, response: Response): Promise<void> {
    sendSuccess(response, await WorkSettingsService.listShifts(requireUserId(request)), "Lay danh sach ca lam thanh cong");
  }

  static async createShift(request: Request, response: Response): Promise<void> {
    const shift = await WorkSettingsService.createShift(requireUserId(request), request.body as WorkShiftInput);
    sendSuccess(response, shift, "Tao ca lam thanh cong", 201);
  }

  static async updateShift(request: Request, response: Response): Promise<void> {
    const shiftId = request.params.id;
    if (typeof shiftId !== "string") throw new AppError(400, "WORK_SHIFT_ID_INVALID", "Ma ca lam khong hop le");
    const shift = await WorkSettingsService.updateShift(requireUserId(request), shiftId, request.body as WorkShiftInput);
    sendSuccess(response, shift, "Cap nhat ca lam thanh cong");
  }

  static async deleteShift(request: Request, response: Response): Promise<void> {
    const shiftId = request.params.id;
    if (typeof shiftId !== "string") throw new AppError(400, "WORK_SHIFT_ID_INVALID", "Ma ca lam khong hop le");
    await WorkSettingsService.deleteShift(requireUserId(request), shiftId);
    response.status(204).send();
  }
}
