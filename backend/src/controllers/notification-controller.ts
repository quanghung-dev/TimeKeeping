import type { Request, Response } from "express";
import { NotificationService } from "../application/services/notification-service.js";
import type { NotificationSettingsInput, PushSubscriptionInput } from "../application/validators/notification-schemas.js";
import { requireUserId } from "../common/middleware/auth.js";
import { sendSuccess } from "../common/responses/api-response.js";

export class NotificationController {
  static async settings(request: Request, response: Response) { sendSuccess(response, await NotificationService.settings(requireUserId(request)), "Lay cau hinh thong bao thanh cong"); }
  static async save(request: Request, response: Response) { sendSuccess(response, await NotificationService.save(requireUserId(request), request.body as NotificationSettingsInput), "Luu cau hinh thong bao thanh cong"); }
  static async list(request: Request, response: Response) { sendSuccess(response, await NotificationService.list(requireUserId(request), Number(request.query.page), Number(request.query.pageSize)), "Lay thong bao thanh cong"); }
  static async read(request: Request, response: Response) { sendSuccess(response, await NotificationService.read(requireUserId(request), request.body.ids as string[]), "Da doc thong bao"); }
  static async subscribe(request: Request, response: Response) { sendSuccess(response, await NotificationService.subscribe(requireUserId(request), request.body as PushSubscriptionInput), "Da dang ky push notification", 201); }
  static async unsubscribe(request: Request, response: Response) { sendSuccess(response, await NotificationService.unsubscribe(requireUserId(request), request.body.endpoint as string), "Da huy push notification"); }
}
