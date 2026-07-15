import type { Request, Response } from "express";
import { CalendarService } from "../application/services/calendar-service.js";
import type { CalendarEventInput, CalendarRange, RecurringEventInput } from "../application/validators/calendar-schemas.js";
import { AppError } from "../common/errors/app-error.js";
import { requireUserId } from "../common/middleware/auth.js";
import { sendSuccess } from "../common/responses/api-response.js";

export class CalendarController {
  static async list(request: Request, response: Response): Promise<void> {
    sendSuccess(response, await CalendarService.list(requireUserId(request), request.query as unknown as CalendarRange), "Lay lich thanh cong");
  }
  static async create(request: Request, response: Response): Promise<void> {
    sendSuccess(response, await CalendarService.create(requireUserId(request), request.body as CalendarEventInput), "Tao su kien thanh cong", 201);
  }
  static async update(request: Request, response: Response): Promise<void> {
    const id = request.params.id;
    if (typeof id !== "string") throw new AppError(400, "CALENDAR_EVENT_ID_INVALID", "Ma su kien khong hop le");
    sendSuccess(response, await CalendarService.update(requireUserId(request), id, request.body as CalendarEventInput), "Cap nhat su kien thanh cong");
  }
  static async delete(request: Request, response: Response): Promise<void> {
    const id = request.params.id;
    if (typeof id !== "string") throw new AppError(400, "CALENDAR_EVENT_ID_INVALID", "Ma su kien khong hop le");
    await CalendarService.delete(requireUserId(request), id);
    response.status(204).send();
  }
  static async copyWeek(request: Request, response: Response): Promise<void> {
    sendSuccess(response, await CalendarService.copyPreviousWeek(requireUserId(request), request.body.weekStart as string), "Sao chep tuan truoc thanh cong");
  }
  static async recurring(request: Request, response: Response): Promise<void> {
    sendSuccess(response, await CalendarService.recurring(requireUserId(request), request.body as RecurringEventInput), "Tao lich lap thanh cong", 201);
  }
  static async googleConnect(_request: Request, _response: Response): Promise<void> {
    throw new AppError(501, "GOOGLE_CALENDAR_NOT_CONFIGURED", "Chua cau hinh Google OAuth credentials");
  }
  static async googleSync(_request: Request, _response: Response): Promise<void> {
    throw new AppError(501, "GOOGLE_CALENDAR_NOT_CONFIGURED", "Chua cau hinh Google OAuth credentials");
  }
}
