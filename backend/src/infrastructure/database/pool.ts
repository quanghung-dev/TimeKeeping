import pg from "pg";
import { getEnv } from "../../config/env.js";

const { Pool } = pg;
let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (pool) return pool;

  const env = getEnv();
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
  });

  pool.on("error", () => {
    // Individual queries surface their own errors. Never log the connection config.
  });

  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}
