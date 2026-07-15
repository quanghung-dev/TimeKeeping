import type { Pool, PoolClient } from "pg";
import type { RegisterInput } from "../../application/validators/auth-schemas.js";
import type { UserRecord } from "../../domain/models/user.js";

type Queryable = Pool | PoolClient;

interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  display_name: string;
  timezone: string;
  company: string | null;
  job_title: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    timezone: row.timezone,
    company: row.company,
    jobTitle: row.job_title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const publicColumns = `
  id, email, password_hash, display_name, timezone,
  company, job_title, created_at, updated_at
`;

export class UserRepository {
  static async findByEmail(db: Queryable, email: string): Promise<UserRecord | null> {
    const result = await db.query<UserRow>(
      `SELECT ${publicColumns} FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  static async findById(db: Queryable, id: string): Promise<UserRecord | null> {
    const result = await db.query<UserRow>(
      `SELECT ${publicColumns} FROM users WHERE id = $1 LIMIT 1`,
      [id],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  static async create(
    db: PoolClient,
    input: RegisterInput,
    passwordHash: string,
  ): Promise<UserRecord> {
    const result = await db.query<UserRow>(
      `INSERT INTO users (email, password_hash, display_name, timezone)
       VALUES ($1, $2, $3, $4)
       RETURNING ${publicColumns}`,
      [input.email.toLowerCase(), passwordHash, input.displayName, input.timezone],
    );
    const row = result.rows[0];
    if (!row) throw new Error("User insert returned no row");
    return mapUser(row);
  }

  static async createDefaults(db: PoolClient, userId: string): Promise<void> {
    await db.query(`INSERT INTO user_settings (user_id) VALUES ($1)`, [userId]);
    await db.query(
      `INSERT INTO work_schedules
        (user_id, day_of_week, is_working_day, start_time, end_time, standard_minutes, default_break_minutes)
       SELECT $1, day_number, day_number <= 5,
              CASE WHEN day_number <= 5 THEN TIME '08:00' ELSE NULL END,
              CASE WHEN day_number <= 5 THEN TIME '17:00' ELSE NULL END,
              CASE WHEN day_number <= 5 THEN 480 ELSE 0 END,
              CASE WHEN day_number <= 5 THEN 60 ELSE 0 END
       FROM generate_series(1, 7) AS day_number`,
      [userId],
    );
  }

  static async updatePassword(db: PoolClient, userId: string, passwordHash: string): Promise<void> {
    await db.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [userId, passwordHash]);
  }
}
