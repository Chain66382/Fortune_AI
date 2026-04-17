import { normalizeBirthProfileToUtc8 } from '../../lib/timezones';
import { generateBazi } from './generateBazi';
import type { UserProfileInput } from '../../types/consultation';
import type { MetaphysicsContext } from './types';

export const buildMetaphysicsContext = (profile: UserProfileInput): MetaphysicsContext => {
  const normalizedProfile = normalizeBirthProfileToUtc8(profile);
  const bazi = generateBazi(normalizedProfile);

  return {
    displayName: normalizedProfile.displayName,
    birthDate: normalizedProfile.birthDate,
    birthDateLunar: normalizedProfile.birthDateLunar || '',
    birthTime: normalizedProfile.birthTime || '',
    timezone: normalizedProfile.birthTimezone || 'UTC+8',
    calendarType: normalizedProfile.birthCalendarType,
    birthLocation: normalizedProfile.birthLocation,
    currentCity: normalizedProfile.currentCity,
    normalizedBirthDateUtc8: normalizedProfile.birthDateUtc8 || normalizedProfile.birthDate,
    normalizedBirthDateLunarUtc8:
      normalizedProfile.birthDateLunarUtc8 || normalizedProfile.birthDateLunar || '',
    normalizedBirthTimeUtc8: normalizedProfile.birthTimeUtc8 || normalizedProfile.birthTime || '',
    bazi
  };
};
