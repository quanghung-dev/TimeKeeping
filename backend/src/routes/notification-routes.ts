import { Router } from "express";
import { notificationQuerySchema, notificationReadSchema, notificationSettingsSchema, pushSubscriptionSchema, pushUnsubscribeSchema } from "../application/validators/notification-schemas.js";
import { asyncHandler } from "../common/middleware/async-handler.js";
import { requireAuth } from "../common/middleware/auth.js";
import { csrfProtection } from "../common/middleware/csrf.js";
import { validateQuery } from "../common/middleware/validate-query.js";
import { validateBody } from "../common/middleware/validate.js";
import { NotificationController as C } from "../controllers/notification-controller.js";

export const notificationRouter = Router();
notificationRouter.use(requireAuth);
notificationRouter.get("/notification-settings", asyncHandler(C.settings));
notificationRouter.put("/notification-settings", csrfProtection, validateBody(notificationSettingsSchema), asyncHandler(C.save));
notificationRouter.get("/notifications", validateQuery(notificationQuerySchema), asyncHandler(C.list));
notificationRouter.post("/notifications/read", csrfProtection, validateBody(notificationReadSchema), asyncHandler(C.read));
notificationRouter.post("/push/subscribe", csrfProtection, validateBody(pushSubscriptionSchema), asyncHandler(C.subscribe));
notificationRouter.post("/push/unsubscribe", csrfProtection, validateBody(pushUnsubscribeSchema), asyncHandler(C.unsubscribe));
