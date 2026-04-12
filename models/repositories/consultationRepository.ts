import { getDatabaseClient } from '@/models/database/databaseClient';
import type { ConsultationRecord } from '@/types/consultation';
import type { KnowledgeEvidence } from '@/types/knowledge';

interface ConsultationRow {
  id: string;
  user_id: string | null;
  status: string;
  save_preference: string;
  unlocked: number;
  free_turns_used: number;
  paid_at: string | null;
  profile_json: string;
  initial_question: string | null;
  preview_answer_json: string | null;
  locked_report_outline_json: string | null;
  report_json: string | null;
  last_evidence_json: string | null;
  order_intent_id: string | null;
  created_at: string;
  updated_at: string;
}

const parseJson = <T>(value: string | null): T | undefined => {
  if (!value) {
    return undefined;
  }

  return JSON.parse(value) as T;
};

export class ConsultationRepository {
  private readonly db = getDatabaseClient().connection;

  private mapRow(row: ConsultationRow): ConsultationRecord {
    return {
      id: row.id,
      userId: row.user_id || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status as ConsultationRecord['status'],
      savePreference: row.save_preference as ConsultationRecord['savePreference'],
      unlocked: Boolean(row.unlocked),
      freeTurnsUsed: Number(row.free_turns_used),
      paidAt: row.paid_at || undefined,
      profile: JSON.parse(row.profile_json),
      initialQuestion: row.initial_question || undefined,
      previewAnswer: parseJson(row.preview_answer_json),
      lockedReportOutline: parseJson(row.locked_report_outline_json),
      report: parseJson(row.report_json),
      lastEvidence: parseJson<KnowledgeEvidence[]>(row.last_evidence_json),
      orderIntentId: row.order_intent_id || undefined
    };
  }

  async getById(id: string): Promise<ConsultationRecord | undefined> {
    const row = this.db
      .prepare(
        `
        SELECT *
        FROM consultations
        WHERE id = ?
      `
      )
      .get(id) as ConsultationRow | undefined;

    return row ? this.mapRow(row) : undefined;
  }

  async create(record: ConsultationRecord): Promise<ConsultationRecord> {
    this.db
      .prepare(
        `
        INSERT INTO consultations (
          id, user_id, status, save_preference, unlocked, free_turns_used, paid_at, profile_json,
          initial_question, preview_answer_json, locked_report_outline_json, report_json,
          last_evidence_json, order_intent_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        record.id,
        record.userId || null,
        record.status,
        record.savePreference,
        record.unlocked ? 1 : 0,
        record.freeTurnsUsed,
        record.paidAt || null,
        JSON.stringify(record.profile),
        record.initialQuestion || null,
        record.previewAnswer ? JSON.stringify(record.previewAnswer) : null,
        record.lockedReportOutline ? JSON.stringify(record.lockedReportOutline) : null,
        record.report ? JSON.stringify(record.report) : null,
        record.lastEvidence ? JSON.stringify(record.lastEvidence) : null,
        record.orderIntentId || null,
        record.createdAt,
        record.updatedAt
      );

    return record;
  }

  async upsert(record: ConsultationRecord): Promise<ConsultationRecord> {
    this.db
      .prepare(
        `
        INSERT INTO consultations (
          id, user_id, status, save_preference, unlocked, free_turns_used, paid_at, profile_json,
          initial_question, preview_answer_json, locked_report_outline_json, report_json,
          last_evidence_json, order_intent_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          status = excluded.status,
          save_preference = excluded.save_preference,
          unlocked = excluded.unlocked,
          free_turns_used = excluded.free_turns_used,
          paid_at = excluded.paid_at,
          profile_json = excluded.profile_json,
          initial_question = excluded.initial_question,
          preview_answer_json = excluded.preview_answer_json,
          locked_report_outline_json = excluded.locked_report_outline_json,
          report_json = excluded.report_json,
          last_evidence_json = excluded.last_evidence_json,
          order_intent_id = excluded.order_intent_id,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `
      )
      .run(
        record.id,
        record.userId || null,
        record.status,
        record.savePreference,
        record.unlocked ? 1 : 0,
        record.freeTurnsUsed,
        record.paidAt || null,
        JSON.stringify(record.profile),
        record.initialQuestion || null,
        record.previewAnswer ? JSON.stringify(record.previewAnswer) : null,
        record.lockedReportOutline ? JSON.stringify(record.lockedReportOutline) : null,
        record.report ? JSON.stringify(record.report) : null,
        record.lastEvidence ? JSON.stringify(record.lastEvidence) : null,
        record.orderIntentId || null,
        record.createdAt,
        record.updatedAt
      );

    return record;
  }
}
