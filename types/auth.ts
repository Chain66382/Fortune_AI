import type { ContactType, PaymentPlan } from '@/types/consultation';

export interface LoginInput {
  contactType: ContactType;
  contactValue: string;
  password: string;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

export interface AuthenticatedUser {
  id: string;
  displayName: string;
  contactType: ContactType;
  contactValue: string;
  consultationCredits: number;
  membershipPlan?: PaymentPlan;
  membershipExpiresAt?: string;
}
