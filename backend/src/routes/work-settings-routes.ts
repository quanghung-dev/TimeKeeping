import { Router } from "express";
import { WorkSettingsController } from "../controllers/work-settings-controller.js";
import { asyncHandler } from "../common/middleware/async-handler.js";
import { requireAuth } from "../common/middleware/auth.js";
import { csrfProtection } from "../common/middleware/csrf.js";
import { validateBody } from "../common/middleware/validate.js";
import { validateParams } from "../common/middleware/validate-params.js";
import { updateWorkSettingsSchema, workShiftIdSchema, workShiftSchema } from "../application/validators/work-settings-schemas.js";

export const workSettingsRouter = Router();
workSettingsRouter.use(requireAuth);
workSettingsRouter.get("/work-settings", asyncHandler(WorkSettingsController.get));
workSettingsRouter.put(
  "/work-settings",
  csrfProtection,
  validateBody(updateWorkSettingsSchema),
  asyncHandler(WorkSettingsController.update),
);
workSettingsRouter.get("/work-shifts", asyncHandler(WorkSettingsController.listShifts));
workSettingsRouter.post(
  "/work-shifts",
  csrfProtection,
  validateBody(workShiftSchema),
  asyncHandler(WorkSettingsController.createShift),
);
workSettingsRouter.put(
  "/work-shifts/:id",
  csrfProtection,
  validateParams(workShiftIdSchema),
  validateBody(workShiftSchema),
  asyncHandler(WorkSettingsController.updateShift),
);
workSettingsRouter.delete(
  "/work-shifts/:id",
  csrfProtection,
  validateParams(workShiftIdSchema),
  asyncHandler(WorkSettingsController.deleteShift),
);
