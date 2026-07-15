import type { PoolClient } from "pg";

interface IdempotencyRow {
  request_hash: string;
  response_status: number | null;
  response_body: unknown;
  completed_at: Date | null;
}

export class IdempotencyRepository {
  static async find(
    db: PoolClient,
    userId: string,
    requestId: string,
    operation: string,
  ): Promise<IdempotencyRow | null> {
    const result = await db.query<IdempotencyRow>(
      `SELECT request_hash, response_status, response_body, completed_at
       FROM idempotency_keys
       WHERE user_id = $1 AND client_request_id = $2 AND operation = $3
       FOR UPDATE`,
      [userId, requestId, operation],
    );
    return result.rows[0] ?? null;
  }

  static async create(
    db: PoolClient,
    userId: string,
    requestId: string,
    operation: string,
    requestHash: string,
  ): Promise<void> {
    await db.query(
      `INSERT INTO idempotency_keys (user_id, client_request_id, operation, request_hash)
       VALUES ($1, $2, $3, $4)`,
      [userId, requestId, operation, requestHash],
    );
  }

  static async complete(
    db: PoolClient,
    userId: string,
    requestId: string,
    operation: string,
    responseStatus: number,
    responseBody: unknown,
    resourceType: string,
    resourceId: string,
  ): Promise<void> {
    await db.query(
      `UPDATE idempotency_keys
       SET response_status = $4, response_body = $5, resource_type = $6,
           resource_id = $7, completed_at = NOW()
       WHERE user_id = $1 AND client_request_id = $2 AND operation = $3`,
      [userId, requestId, operation, responseStatus, JSON.stringify(responseBody), resourceType, resourceId],
    );
  }
}
