import { Router } from "express";
import { leaveIdSchema, leaveInputSchema, leaveListQuerySchema, leaveSummaryQuerySchema } from "../application/validators/leave-schemas.js";
import { asyncHandler } from "../common/middleware/async-handler.js";
import { requireAuth } from "../common/middleware/auth.js";
import { csrfProtection } from "../common/middleware/csrf.js";
import { validateParams } from "../common/middleware/validate-params.js";
import { validateQuery } from "../common/middleware/validate-query.js";
import { validateBody } from "../common/middleware/validate.js";
import { LeaveController } from "../controllers/leave-controller.js";

export const leaveRouter = Router();
leaveRouter.use(requireAuth);
leaveRouter.get("/leaves", validateQuery(leaveListQuerySchema), asyncHandler(LeaveController.list));
leaveRouter.get("/leaves/summary", validateQuery(leaveSummaryQuerySchema), asyncHandler(LeaveController.summary));
leaveRouter.get("/leaves/balance", validateQuery(leaveSummaryQuerySchema), asyncHandler(LeaveController.balance));
leaveRouter.post("/leaves", csrfProtection, validateBody(leaveInputSchema), asyncHandler(LeaveController.create));
leaveRouter.put("/leaves/:id", csrfProtection, validateParams(leaveIdSchema), validateBody(leaveInputSchema), asyncHandler(LeaveController.update));
leaveRouter.delete("/leaves/:id", csrfProtection, validateParams(leaveIdSchema), asyncHandler(LeaveController.delete));
