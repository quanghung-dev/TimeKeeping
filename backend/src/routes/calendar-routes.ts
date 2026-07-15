import { Router } from "express";
import { calendarEventIdSchema, calendarEventSchema, calendarRangeSchema, copyWeekSchema, recurringEventSchema } from "../application/validators/calendar-schemas.js";
import { asyncHandler } from "../common/middleware/async-handler.js";
import { requireAuth } from "../common/middleware/auth.js";
import { csrfProtection } from "../common/middleware/csrf.js";
import { validateParams } from "../common/middleware/validate-params.js";
import { validateQuery } from "../common/middleware/validate-query.js";
import { validateBody } from "../common/middleware/validate.js";
import { CalendarController } from "../controllers/calendar-controller.js";

export const calendarRouter = Router();
calendarRouter.use(requireAuth);
for (const path of ["/calendar", "/calendar/day", "/calendar/week", "/calendar/month"]) {
  calendarRouter.get(path, validateQuery(calendarRangeSchema), asyncHandler(CalendarController.list));
}
calendarRouter.post("/calendar/events", csrfProtection, validateBody(calendarEventSchema), asyncHandler(CalendarController.create));
calendarRouter.put("/calendar/events/:id", csrfProtection, validateParams(calendarEventIdSchema), validateBody(calendarEventSchema), asyncHandler(CalendarController.update));
calendarRouter.delete("/calendar/events/:id", csrfProtection, validateParams(calendarEventIdSchema), asyncHandler(CalendarController.delete));
calendarRouter.post("/calendar/copy-previous-week", csrfProtection, validateBody(copyWeekSchema), asyncHandler(CalendarController.copyWeek));
calendarRouter.post("/calendar/recurring", csrfProtection, validateBody(recurringEventSchema), asyncHandler(CalendarController.recurring));
calendarRouter.post("/integrations/google-calendar/connect", csrfProtection, asyncHandler(CalendarController.googleConnect));
calendarRouter.post("/integrations/google-calendar/sync", csrfProtection, asyncHandler(CalendarController.googleSync));
