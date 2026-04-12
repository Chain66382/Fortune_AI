import type { KnowledgeEvidence } from '@/types/knowledge';

export type ConsultationStatus =
  | 'draft'
  | 'preview_ready'
  | 'report_ready'
  | 'payment_required'
  | 'paid';
export type GenderOption = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';
export type SavePreference = 'save' | 'do_not_save';
export type ContactType = 'email' | 'phone';
export type PaymentPlan = 'consultation_pack_1000' | 'monthly_membership' | 'yearly_membership';
export type PaymentMethod = 'usdt' | 'wechat_pay' | 'alipay' | 'visa';
export type CalendarType = 'lunar' | 'solar';
export type FocusArea =
  | 'overall'
  | 'love'
  | 'career'
  | 'wealth'
  | 'health'
  | 'dream'
  | 'feng_shui'
  | 'fortune_cycle';
export type AssetCategory = 'face' | 'palm' | 'space' | 'other';

export interface UploadedAsset {
  id: string;
  fileName: string;
  mimeType: string;
  filePath: string;
  publicUrl: string;
  size: number;
  category: AssetCategory;
  uploadedAt: string;
}

export interface UserProfileInput {
  displayName: string;
  gender: GenderOption;
  birthDate: string;
  birthCalendarType: CalendarType;
  birthDateLunar?: string;
  birthIsLeapMonth?: boolean;
  birthTime?: string;
  birthLocation: string;
  currentCity: string;
  focusArea: FocusArea;
  currentChallenge: string;
  dreamContext?: string;
  fengShuiContext?: string;
  uploadedAssets: UploadedAsset[];
}

export interface RegistrationInput {
  contactType: ContactType;
  contactValue: string;
  password: string;
}

export interface LockedReportOutlineItem {
  title: string;
  teaser: string;
}

export interface AnswerPayload {
  headline: string;
  summary: string;
  details: string[];
  guidance: string[];
  evidence: KnowledgeEvidence[];
}

export interface ConsultationReport {
  summary: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
  actionItems: string[];
  evidence: KnowledgeEvidence[];
}

export interface ConsultationRecord {
  id: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  status: ConsultationStatus;
  savePreference: SavePreference;
  unlocked: boolean;
  freeTurnsUsed: number;
  paidAt?: string;
  profile: UserProfileInput;
  initialQuestion?: string;
  previewAnswer?: AnswerPayload;
  lockedReportOutline?: LockedReportOutlineItem[];
  report?: ConsultationReport;
  lastEvidence?: KnowledgeEvidence[];
  orderIntentId?: string;
}

export type MessageRole = 'user' | 'assistant';

export interface ConsultationMessage {
  id: string;
  consultationId: string;
  role: MessageRole;
  headline?: string;
  content: string;
  createdAt: string;
  evidence: KnowledgeEvidence[];
}

export interface OrderIntentInput {
  contactName: string;
  contactChannel: string;
  note?: string;
}

export interface OrderIntentRecord extends OrderIntentInput {
  id: string;
  consultationId: string;
  createdAt: string;
  unlockedAt?: string;
}

export interface CreateConsultationInput {
  profile: UserProfileInput;
  savePreference: SavePreference;
  registration?: RegistrationInput;
}

export interface PreviewConsultationInput {
  question: string;
}

export interface ChatInput {
  message: string;
}

export interface AttachAssetsInput {
  uploadedAssets: UploadedAsset[];
}

export interface CheckoutInput {
  registration?: RegistrationInput;
  paymentPlan?: PaymentPlan;
  paymentMethod?: PaymentMethod;
}

export interface ConsultationReplyPayload {
  answer: AnswerPayload;
  message: ConsultationMessage;
  paymentRequired: boolean;
  requiresRegistrationForPayment: boolean;
  freeTurnsRemaining: number;
  paid: boolean;
}

export interface UserAccountRecord {
  id: string;
  contactType: ContactType;
  contactValue: string;
  passwordHash: string;
  displayName: string;
  consultationCredits: number;
  membershipPlan?: PaymentPlan;
  membershipExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  consultationId: string;
  userId?: string;
  amountCents: number;
  currency: string;
  paymentMethod: PaymentMethod;
  planCode: PaymentPlan;
  planName: string;
  consultationCreditsGranted: number;
  membershipExpiresAt?: string;
  status: 'paid';
  createdAt: string;
  paidAt: string;
}
