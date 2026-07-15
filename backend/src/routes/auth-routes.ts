import { Router } from "express";
import { AuthController } from "../controllers/auth-controller.js";
import { asyncHandler } from "../common/middleware/async-handler.js";
import { requireAuth } from "../common/middleware/auth.js";
import { validateBody } from "../common/middleware/validate.js";
import { csrfProtection } from "../common/middleware/csrf.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../application/validators/auth-schemas.js";

export const authRouter = Router();

authRouter.get("/csrf", asyncHandler(AuthController.csrf));
authRouter.post("/register", csrfProtection, validateBody(registerSchema), asyncHandler(AuthController.register));
authRouter.post("/login", csrfProtection, validateBody(loginSchema), asyncHandler(AuthController.login));
authRouter.post("/refresh", csrfProtection, asyncHandler(AuthController.refresh));
authRouter.post("/logout", csrfProtection, asyncHandler(AuthController.logout));
authRouter.post(
  "/forgot-password",
  csrfProtection,
  validateBody(forgotPasswordSchema),
  asyncHandler(AuthController.forgotPassword),
);
authRouter.post(
  "/reset-password",
  csrfProtection,
  validateBody(resetPasswordSchema),
  asyncHandler(AuthController.resetPassword),
);
authRouter.get("/me", requireAuth, asyncHandler(AuthController.me));
authRouter.put(
  "/change-password",
  requireAuth,
  csrfProtection,
  validateBody(changePasswordSchema),
  asyncHandler(AuthController.changePassword),
);
