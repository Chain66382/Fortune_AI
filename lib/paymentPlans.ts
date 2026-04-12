import type { PaymentPlan } from '@/types/consultation';

export interface PaymentPlanConfig {
  code: PaymentPlan;
  label: string;
  description: string;
  amountCents: number;
  currency: 'USD';
  consultationCreditsGranted: number;
  membershipDays?: number;
}

export const PAYMENT_PLANS: Record<PaymentPlan, PaymentPlanConfig> = {
  consultation_pack_1000: {
    code: 'consultation_pack_1000',
    label: '1000 次咨询',
    description: '一次购买 1000 次付费咨询额度，适合高频使用。',
    amountCents: 200,
    currency: 'USD',
    consultationCreditsGranted: 1000
  },
  monthly_membership: {
    code: 'monthly_membership',
    label: '月度会员',
    description: '30 天内持续咨询与补资料，适合集中阶段深入看。',
    amountCents: 1000,
    currency: 'USD',
    consultationCreditsGranted: 0,
    membershipDays: 30
  },
  yearly_membership: {
    code: 'yearly_membership',
    label: '年度会员',
    description: '365 天长期陪伴式咨询，适合长期追踪运势变化。',
    amountCents: 10000,
    currency: 'USD',
    consultationCreditsGranted: 0,
    membershipDays: 365
  }
};

export const PAYMENT_PLAN_OPTIONS = Object.values(PAYMENT_PLANS);

export const getPaymentPlanConfig = (plan: PaymentPlan): PaymentPlanConfig => PAYMENT_PLANS[plan];

export const formatMoney = (amountCents: number, currency: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amountCents / 100);
