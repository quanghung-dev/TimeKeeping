import express, { Router } from "express";
import { ProfileController } from "../controllers/profile-controller.js";
import { requireAuth } from "../common/middleware/auth.js";
import { asyncHandler } from "../common/middleware/async-handler.js";
import { csrfProtection } from "../common/middleware/csrf.js";
import { validateBody } from "../common/middleware/validate.js";
import { updateProfileSchema } from "../application/validators/profile-schemas.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);
profileRouter.get("/", asyncHandler(ProfileController.get));
profileRouter.put("/", csrfProtection, validateBody(updateProfileSchema), asyncHandler(ProfileController.update));
profileRouter.get("/avatar", asyncHandler(ProfileController.avatar));
profileRouter.post(
  "/avatar",
  csrfProtection,
  express.raw({ type: ["image/jpeg", "image/jpg", "image/png", "image/webp"], limit: "2mb" }),
  asyncHandler(ProfileController.updateAvatar),
);
