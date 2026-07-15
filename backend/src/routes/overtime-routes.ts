import { Router } from "express";
import { overtimeEndSchema, overtimeIdSchema, overtimeInputSchema, overtimeQuerySchema, overtimeStartSchema } from "../application/validators/overtime-schemas.js";
import { asyncHandler } from "../common/middleware/async-handler.js";
import { requireAuth } from "../common/middleware/auth.js";
import { csrfProtection } from "../common/middleware/csrf.js";
import { validateParams } from "../common/middleware/validate-params.js";
import { validateQuery } from "../common/middleware/validate-query.js";
import { validateBody } from "../common/middleware/validate.js";
import { OvertimeController } from "../controllers/overtime-controller.js";

export const overtimeRouter = Router(); overtimeRouter.use(requireAuth);
overtimeRouter.get("/overtime", validateQuery(overtimeQuerySchema), asyncHandler(OvertimeController.list));
overtimeRouter.get("/overtime/active", asyncHandler(OvertimeController.active));
overtimeRouter.get("/overtime/summary", validateQuery(overtimeQuerySchema), asyncHandler(OvertimeController.summary));
overtimeRouter.post("/overtime/start", csrfProtection, validateBody(overtimeStartSchema), asyncHandler(OvertimeController.start));
overtimeRouter.post("/overtime/end", csrfProtection, validateBody(overtimeEndSchema), asyncHandler(OvertimeController.end));
overtimeRouter.post("/overtime", csrfProtection, validateBody(overtimeInputSchema), asyncHandler(OvertimeController.create));
overtimeRouter.put("/overtime/:id", csrfProtection, validateParams(overtimeIdSchema), validateBody(overtimeInputSchema), asyncHandler(OvertimeController.update));
overtimeRouter.delete("/overtime/:id", csrfProtection, validateParams(overtimeIdSchema), asyncHandler(OvertimeController.delete));
