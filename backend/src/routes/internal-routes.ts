import { Router } from "express";
import { NotificationService } from "../application/services/notification-service.js";
import { asyncHandler } from "../common/middleware/async-handler.js";
import { AppError } from "../common/errors/app-error.js";
import { sendSuccess } from "../common/responses/api-response.js";
import { getEnv } from "../config/env.js";

export const internalRouter = Router();
internalRouter.get("/internal/reminders", asyncHandler(async (request, response) => {
  const secret = getEnv().CRON_SECRET;
  if (!secret || request.get("authorization") !== `Bearer ${secret}`) {
    throw new AppError(401, "CRON_UNAUTHORIZED", "Cron secret khong hop le");
  }
  sendSuccess(response, await NotificationService.generate(), "Da tao nhac nho");
}));
