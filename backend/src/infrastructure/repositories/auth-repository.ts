import type { Pool, PoolClient } from "pg";

type Queryable = Pool | PoolClient;

export interface StoredRefreshToken {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

interface RefreshTokenRow {
  id: string;
  user_id: string;
  family_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

function mapToken(row: RefreshTokenRow): StoredRefreshToken {
  return {
    id: row.id,
    userId: row.user_id,
    familyId: row.family_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export class AuthRepository {
  static async insertPasswordResetToken(db: Queryable, userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await db.query(`UPDATE password_reset_tokens SET used_at = COALESCE(used_at, NOW()) WHERE user_id = $1 AND used_at IS NULL`, [userId]);
    await db.query(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [userId, tokenHash, expiresAt]);
  }

  static async consumePasswordResetToken(db: PoolClient, tokenHash: string): Promise<string | null> {
    const result = await db.query<{ user_id: string }>(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING user_id`,
      [tokenHash],
    );
    return result.rows[0]?.user_id ?? null;
  }
  static async insertRefreshToken(
    db: Queryable,
    token: {
      id: string;
      userId: string;
      familyId: string;
      tokenHash: string;
      expiresAt: Date;
      ipHash: string;
      userAgent: string;
    },
  ): Promise<void> {
    await db.query(
      `INSERT INTO refresh_tokens
        (id, user_id, family_id, token_hash, expires_at, created_by_ip_hash, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [token.id, token.userId, token.familyId, token.tokenHash, token.expiresAt, token.ipHash, token.userAgent],
    );
  }

  static async findRefreshTokenForUpdate(
    db: PoolClient,
    tokenHash: string,
  ): Promise<StoredRefreshToken | null> {
    const result = await db.query<RefreshTokenRow>(
      `SELECT id, user_id, family_id, token_hash, expires_at, revoked_at
       FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash],
    );
    return result.rows[0] ? mapToken(result.rows[0]) : null;
  }

  static async rotateRefreshToken(db: PoolClient, oldId: string, newId: string): Promise<void> {
    await db.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(), replaced_by_token_id = $2
       WHERE id = $1 AND revoked_at IS NULL`,
      [oldId, newId],
    );
  }

  static async revokeByHash(db: Queryable, tokenHash: string): Promise<void> {
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  static async revokeFamily(db: Queryable, familyId: string): Promise<void> {
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE family_id = $1`,
      [familyId],
    );
  }

  static async revokeAllForUser(db: Queryable, userId: string): Promise<void> {
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1`,
      [userId],
    );
  }

  static async countRecentFailures(
    db: Queryable,
    emailHash: string,
    ipHash: string,
  ): Promise<number> {
    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM login_attempts
       WHERE email_hash = $1 AND ip_hash = $2 AND succeeded = FALSE
         AND attempted_at >= NOW() - INTERVAL '15 minutes'`,
      [emailHash, ipHash],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  static async recordLoginAttempt(
    db: Queryable,
    emailHash: string,
    ipHash: string,
    succeeded: boolean,
  ): Promise<void> {
    await db.query(
      `INSERT INTO login_attempts (email_hash, ip_hash, succeeded) VALUES ($1, $2, $3)`,
      [emailHash, ipHash, succeeded],
    );
  }
}
