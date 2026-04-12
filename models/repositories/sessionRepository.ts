import { getDatabaseClient } from '@/models/database/databaseClient';
import type { AuthSessionRecord } from '@/types/auth';

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

export class SessionRepository {
  private readonly db = getDatabaseClient().connection;

  private mapRow(row: SessionRow): AuthSessionRecord {
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    };
  }

  async create(record: AuthSessionRecord): Promise<AuthSessionRecord> {
    this.db
      .prepare(
        `
        INSERT INTO auth_sessions (
          id, user_id, token_hash, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `
      )
      .run(record.id, record.userId, record.tokenHash, record.expiresAt, record.createdAt);

    return record;
  }

  async getByTokenHash(tokenHash: string): Promise<AuthSessionRecord | undefined> {
    const row = this.db
      .prepare(
        `
        SELECT *
        FROM auth_sessions
        WHERE token_hash = ?
        LIMIT 1
      `
      )
      .get(tokenHash) as SessionRow | undefined;

    return row ? this.mapRow(row) : undefined;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    this.db
      .prepare(
        `
        DELETE FROM auth_sessions
        WHERE token_hash = ?
      `
      )
      .run(tokenHash);
  }
}
