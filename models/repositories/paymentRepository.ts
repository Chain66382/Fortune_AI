import { getDatabaseClient } from '@/models/database/databaseClient';
import type { PaymentRecord } from '@/types/consultation';

interface PaymentRow {
  id: string;
  consultation_id: string;
  user_id: string | null;
  amount_cents: number;
  currency: string;
  payment_method: string;
  plan_code: string;
  plan_name: string;
  consultation_credits_granted: number;
  membership_expires_at: string | null;
  status: 'paid';
  created_at: string;
  paid_at: string;
}

export class PaymentRepository {
  private readonly db = getDatabaseClient().connection;

  private mapRow(row: PaymentRow): PaymentRecord {
    return {
      id: row.id,
      consultationId: row.consultation_id,
      userId: row.user_id || undefined,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      paymentMethod: row.payment_method as PaymentRecord['paymentMethod'],
      planCode: row.plan_code as PaymentRecord['planCode'],
      planName: row.plan_name,
      consultationCreditsGranted: Number(row.consultation_credits_granted),
      membershipExpiresAt: row.membership_expires_at || undefined,
      status: row.status,
      createdAt: row.created_at,
      paidAt: row.paid_at
    };
  }

  async create(record: PaymentRecord): Promise<PaymentRecord> {
    this.db
      .prepare(
        `
        INSERT INTO payments (
          id, consultation_id, user_id, amount_cents, currency, payment_method, plan_code, plan_name,
          consultation_credits_granted, membership_expires_at, status, created_at, paid_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        record.id,
        record.consultationId,
        record.userId || null,
        record.amountCents,
        record.currency,
        record.paymentMethod,
        record.planCode,
        record.planName,
        record.consultationCreditsGranted,
        record.membershipExpiresAt || null,
        record.status,
        record.createdAt,
        record.paidAt
      );

    return record;
  }

  async getLatestByConsultationId(consultationId: string): Promise<PaymentRecord | undefined> {
    const row = this.db
      .prepare(
        `
        SELECT *
        FROM payments
        WHERE consultation_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
      )
      .get(consultationId) as PaymentRow | undefined;

    return row ? this.mapRow(row) : undefined;
  }
}
