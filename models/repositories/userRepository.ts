import { getDatabaseClient } from '@/models/database/databaseClient';
import type { UserAccountRecord, UserProfileInput } from '@/types/consultation';

interface UserRow {
  id: string;
  contact_type: string;
  contact_value: string;
  password_hash: string;
  display_name: string;
  consultation_credits: number;
  membership_plan: string | null;
  membership_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export class UserRepository {
  private readonly db = getDatabaseClient().connection;

  private mapRow(row: UserRow): UserAccountRecord {
    return {
      id: row.id,
      contactType: row.contact_type as UserAccountRecord['contactType'],
      contactValue: row.contact_value,
      passwordHash: row.password_hash,
      displayName: row.display_name,
      consultationCredits: Number(row.consultation_credits),
      membershipPlan: row.membership_plan as UserAccountRecord['membershipPlan'],
      membershipExpiresAt: row.membership_expires_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getByContactValue(contactValue: string): Promise<UserAccountRecord | undefined> {
    const row = this.db
      .prepare(
        `
        SELECT *
        FROM users
        WHERE contact_value = ?
      `
      )
      .get(contactValue) as UserRow | undefined;

    return row ? this.mapRow(row) : undefined;
  }

  async getById(id: string): Promise<UserAccountRecord | undefined> {
    const row = this.db
      .prepare(
        `
        SELECT *
        FROM users
        WHERE id = ?
      `
      )
      .get(id) as UserRow | undefined;

    return row ? this.mapRow(row) : undefined;
  }

  async create(record: UserAccountRecord): Promise<UserAccountRecord> {
    this.db
      .prepare(
        `
        INSERT INTO users (
          id, contact_type, contact_value, password_hash, display_name, consultation_credits,
          membership_plan, membership_expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        record.id,
        record.contactType,
        record.contactValue,
        record.passwordHash,
        record.displayName,
        record.consultationCredits,
        record.membershipPlan || null,
        record.membershipExpiresAt || null,
        record.createdAt,
        record.updatedAt
      );

    return record;
  }

  async updateDisplayName(id: string, displayName: string): Promise<void> {
    this.db
      .prepare(
        `
        UPDATE users
        SET display_name = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(displayName, new Date().toISOString(), id);
  }

  async updateAccessState(
    id: string,
    accessState: {
      consultationCredits: number;
      membershipPlan?: UserAccountRecord['membershipPlan'];
      membershipExpiresAt?: string;
    }
  ): Promise<void> {
    this.db
      .prepare(
        `
        UPDATE users
        SET consultation_credits = ?, membership_plan = ?, membership_expires_at = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(
        accessState.consultationCredits,
        accessState.membershipPlan || null,
        accessState.membershipExpiresAt || null,
        new Date().toISOString(),
        id
      );
  }
}
