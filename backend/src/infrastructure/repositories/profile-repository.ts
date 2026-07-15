import type { Pool, PoolClient } from "pg";
import type { UpdateProfileInput } from "../../application/validators/profile-schemas.js";
import type { UserAvatar, UserProfile } from "../../domain/models/profile.js";

type Queryable = Pool | PoolClient;

interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  company: string | null;
  job_title: string | null;
  timezone: string;
  time_format: "12h" | "24h";
  language: "vi" | "en";
  week_starts_on: number;
  currency: string;
  theme_mode: "light" | "dark" | "system";
  accent_color: string;
  has_avatar: boolean;
}

function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    company: row.company,
    jobTitle: row.job_title,
    timezone: row.timezone,
    timeFormat: row.time_format,
    language: row.language,
    weekStartsOn: row.week_starts_on,
    currency: row.currency,
    themeMode: row.theme_mode,
    accentColor: row.accent_color,
    hasAvatar: row.has_avatar,
  };
}

export class ProfileRepository {
  static async get(db: Queryable, userId: string): Promise<UserProfile | null> {
    const result = await db.query<ProfileRow>(
      `SELECT u.id, u.email, u.display_name, u.company, u.job_title, u.timezone,
              s.time_format, s.language, s.week_starts_on, s.currency,
              s.theme_mode, s.accent_color,
              EXISTS (SELECT 1 FROM user_avatars a WHERE a.user_id = u.id) AS has_avatar
       FROM users u
       INNER JOIN user_settings s ON s.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    return result.rows[0] ? mapProfile(result.rows[0]) : null;
  }

  static async updateUser(db: PoolClient, userId: string, input: UpdateProfileInput): Promise<void> {
    await db.query(
      `UPDATE users
       SET display_name = $2, company = $3, job_title = $4, timezone = $5
       WHERE id = $1`,
      [userId, input.displayName, input.company, input.jobTitle, input.timezone],
    );
  }

  static async updateSettings(db: PoolClient, userId: string, input: UpdateProfileInput): Promise<void> {
    await db.query(
      `UPDATE user_settings
       SET time_format = $2, language = $3, week_starts_on = $4,
           currency = $5, theme_mode = $6, accent_color = $7
       WHERE user_id = $1`,
      [
        userId,
        input.timeFormat,
        input.language,
        input.weekStartsOn,
        input.currency,
        input.themeMode,
        input.accentColor,
      ],
    );
  }

  static async upsertAvatar(
    db: Queryable,
    userId: string,
    avatar: UserAvatar,
  ): Promise<void> {
    await db.query(
      `INSERT INTO user_avatars (user_id, content_type, file_size, content, content_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE
       SET content_type = EXCLUDED.content_type,
           file_size = EXCLUDED.file_size,
           content = EXCLUDED.content,
           content_hash = EXCLUDED.content_hash`,
      [userId, avatar.contentType, avatar.content.length, avatar.content, avatar.contentHash],
    );
  }

  static async getAvatar(db: Queryable, userId: string): Promise<UserAvatar | null> {
    const result = await db.query<{
      content_type: UserAvatar["contentType"];
      content: Buffer;
      content_hash: string;
    }>(
      `SELECT content_type, content, content_hash FROM user_avatars WHERE user_id = $1`,
      [userId],
    );
    const row = result.rows[0];
    return row
      ? { contentType: row.content_type, content: row.content, contentHash: row.content_hash }
      : null;
  }
}
