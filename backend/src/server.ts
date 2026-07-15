import "dotenv/config";
import app from "./index.js";
import { getEnv } from "./config/env.js";
import { logger } from "./common/logging/logger.js";

const env = getEnv();
app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "TimeKeeping API listening");
});
