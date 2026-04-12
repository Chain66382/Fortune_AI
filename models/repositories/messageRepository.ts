import { getDatabaseClient } from '@/models/database/databaseClient';
import type { ConsultationMessage } from '@/types/consultation';

interface MessageRow {
  id: string;
  consultation_id: string;
  role: string;
  headline: string | null;
  content: string;
  evidence_json: string;
  created_at: string;
}

export class MessageRepository {
  private readonly db = getDatabaseClient().connection;

  private mapRow(row: MessageRow): ConsultationMessage {
    return {
      id: row.id,
      consultationId: row.consultation_id,
      role: row.role as ConsultationMessage['role'],
      headline: row.headline || undefined,
      content: row.content,
      createdAt: row.created_at,
      evidence: JSON.parse(row.evidence_json)
    };
  }

  async create(record: ConsultationMessage): Promise<ConsultationMessage> {
    this.db
      .prepare(
        `
        INSERT INTO messages (id, consultation_id, role, headline, content, evidence_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        record.id,
        record.consultationId,
        record.role,
        record.headline || null,
        record.content,
        JSON.stringify(record.evidence),
        record.createdAt
      );

    return record;
  }

  async findManyByConsultationId(consultationId: string): Promise<ConsultationMessage[]> {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM messages
        WHERE consultation_id = ?
        ORDER BY created_at ASC
      `
      )
      .all(consultationId) as MessageRow[];

    return rows.map((row) => this.mapRow(row));
  }

  async countUserMessagesByConsultationId(consultationId: string): Promise<number> {
    const row = this.db
      .prepare(
        `
        SELECT count(*) AS count
        FROM messages
        WHERE consultation_id = ? AND role = 'user'
      `
      )
      .get(consultationId) as { count: number };

    return Number(row.count);
  }
}
