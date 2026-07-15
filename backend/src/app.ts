import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { pinoHttp } from "pino-http";
import { AppError } from "./common/errors/app-error.js";
import { errorHandler } from "./common/middleware/error-handler.js";
import { logger } from "./common/logging/logger.js";
import { sendSuccess } from "./common/responses/api-response.js";
import { authRouter } from "./routes/auth-routes.js";
import { profileRouter } from "./routes/profile-routes.js";
import { workSettingsRouter } from "./routes/work-settings-routes.js";
import { attendanceRouter } from "./routes/attendance-routes.js";
import { leaveRouter } from "./routes/leave-routes.js";
import { calendarRouter } from "./routes/calendar-routes.js";
import { overtimeRouter } from "./routes/overtime-routes.js";
import { productivityRouter } from "./routes/productivity-routes.js";
import { reportRouter } from "./routes/report-routes.js";
import { payrollRouter } from "./routes/payroll-routes.js";
import { notificationRouter } from "./routes/notification-routes.js";
import { dataRouter } from "./routes/data-routes.js";
import { openApiDocument } from "./config/openapi.js";
import { internalRouter } from "./routes/internal-routes.js";
import { asyncHandler } from "./common/middleware/async-handler.js";
import { getPool } from "./infrastructure/database/pool.js";

function allowedOrigins(): string[] {
  return (process.env.FRONTEND_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const removeDocsCsp: express.RequestHandler = (_request, response, next) => {
  response.removeHeader("Content-Security-Policy");
  next();
};

export function createApp(): express.Express {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins().includes(origin)) callback(null, true);
        else callback(new AppError(403, "ORIGIN_NOT_ALLOWED", "Origin khong duoc phep"));
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api", (_request, response, next) => {
    response.setHeader("Cache-Control", "private, no-store");
    next();
  });

  app.get("/api/health", (_request, response) => {
    sendSuccess(response, { status: "ok" }, "API dang hoat dong");
  });
  app.get(
    "/api/health/db",
    asyncHandler(async (_request, response) => {
      try {
        const pool = getPool();
        await pool.query("SELECT 1");
        sendSuccess(
          response,
          { status: "ok", database: "connected" },
          "Ket noi database thanh cong",
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new AppError(500, "DATABASE_CONNECTION_ERROR", "Khong the ket noi den database", {
          database: [message],
        });
      }
    }),
  );
  app.get("/api/openapi.json", (_request,response)=>response.json(openApiDocument));
  app.use("/api/docs", removeDocsCsp, swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use("/api/auth", authRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api", workSettingsRouter);
  app.use("/api", attendanceRouter);
  app.use("/api", leaveRouter);
  app.use("/api", calendarRouter);
  app.use("/api", overtimeRouter);
  app.use("/api", productivityRouter);
  app.use("/api", reportRouter);
  app.use("/api", payrollRouter);
  app.use("/api", notificationRouter);
  app.use("/api", dataRouter);
  app.use("/api", internalRouter);

  app.use((request, _response, next) => {
    next(new AppError(404, "ROUTE_NOT_FOUND", `Khong tim thay ${request.method} ${request.path}`));
  });
  app.use(errorHandler);
  return app;
}
