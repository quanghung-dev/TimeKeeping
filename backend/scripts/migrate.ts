import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { getEnv } from "../src/config/env.js";

const { Client } = pg;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const migrationDirectory = resolve(scriptDirectory, "../../frontend/migration");
const baselineLastMigration = "11_views.sql";

interface Migration {
  name: string;
  sql: string;
  checksum: string;
}

async function loadMigrations(): Promise<Migration[]> {
  const names = (await readdir(migrationDirectory))
    .filter((name) => /^\d{2}_.+\.sql$/.test(name))
    .sort((left, right) => left.localeCompare(right));
  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(resolve(migrationDirectory, name), "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    }),
  );
}

async function ensureMigrationTable(client: pg.Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedMigrations(client: pg.Client): Promise<Map<string, string>> {
  const result = await client.query<{ name: string; checksum: string }>(
    `SELECT name, checksum FROM schema_migrations ORDER BY name`,
  );
  return new Map(result.rows.map((row) => [row.name, row.checksum]));
}

async function hasExistingBaseline(client: pg.Client): Promise<boolean> {
  const result = await client.query<{ complete: boolean }>(`
    SELECT
      to_regclass('public.users') IS NOT NULL
      AND to_regclass('public.user_settings') IS NOT NULL
      AND to_regclass('public.work_schedules') IS NOT NULL
      AND to_regclass('public.attendance_days') IS NOT NULL
      AND to_regclass('public.attendance_sessions') IS NOT NULL
      AND to_regclass('public.break_sessions') IS NOT NULL
      AND to_regclass('public.leave_days') IS NOT NULL
      AND to_regclass('public.holidays') IS NOT NULL
      AND to_regclass('public.daily_notes') IS NOT NULL
      AND to_regclass('public.salary_settings') IS NOT NULL
      AND to_regclass('public.v_daily_attendance_summary') IS NOT NULL
      AS complete
  `);
  return result.rows[0]?.complete ?? false;
}

async function baseline(client: pg.Client, migrations: Migration[]): Promise<void> {
  if (!(await hasExistingBaseline(client))) {
    throw new Error("Baseline schema is incomplete. Use migration:up for an empty database.");
  }
  const baselineMigrations = migrations.filter((migration) => migration.name <= baselineLastMigration);
  await client.query("BEGIN");
  try {
    for (const migration of baselineMigrations) {
      await client.query(
        `INSERT INTO schema_migrations (name, checksum)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum`,
        [migration.name, migration.checksum],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  process.stdout.write(`Baselined ${baselineMigrations.length} migrations.\n`);
}

async function migrateUp(client: pg.Client, migrations: Migration[]): Promise<void> {
  const applied = await appliedMigrations(client);
  if (applied.size === 0 && (await hasExistingBaseline(client))) {
    throw new Error("Existing schema detected without migration history. Run migration:baseline first.");
  }

  for (const migration of migrations) {
    const previousChecksum = applied.get(migration.name);
    if (previousChecksum) {
      if (previousChecksum !== migration.checksum) {
        throw new Error(`Applied migration was modified: ${migration.name}`);
      }
      continue;
    }

    await client.query("BEGIN");
    try {
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)`,
        [migration.name, migration.checksum],
      );
      await client.query("COMMIT");
      process.stdout.write(`Applied ${migration.name}.\n`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

async function main(): Promise<void> {
  const env = getEnv();
  const client = new Client({
    connectionString: env.DATABASE_DIRECT_URL ?? env.DATABASE_URL,
    ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  try {
    await ensureMigrationTable(client);
    const migrations = await loadMigrations();
    const command = process.argv[2] ?? "status";
    if (command === "baseline") await baseline(client, migrations);
    else if (command === "up") await migrateUp(client, migrations);
    else if (command === "status") {
      const applied = await appliedMigrations(client);
      for (const migration of migrations) {
        const checksum = applied.get(migration.name);
        const state = !checksum ? "pending" : checksum === migration.checksum ? "applied" : "modified";
        process.stdout.write(`${state.padEnd(8)} ${migration.name}\n`);
      }
    } else {
      throw new Error(`Unknown migration command: ${command}`);
    }
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown migration error";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
