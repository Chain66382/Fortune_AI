import type { ConsultationRecord } from '../../types/consultation';
import type { LoadedUserProfile } from './types';

export const loadUserProfile = (consultation: ConsultationRecord): LoadedUserProfile => ({
  consultationId: consultation.id,
  profile: consultation.profile
});
