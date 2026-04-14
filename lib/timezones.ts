import {
  convertLunarToSolar,
  convertSolarToLunar,
  formatLunarDate,
  parseStoredLunarDate
} from '@/lib/lunarCalendar';
import type { UserProfileInput } from '@/types/consultation';

export interface TimezoneOption {
  value: string;
  label: string;
  offsetMinutes: number;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'UTC+8', label: 'UTC+8（中国/新加坡）', offsetMinutes: 8 * 60 },
  { value: 'UTC+9', label: 'UTC+9（日本/韩国）', offsetMinutes: 9 * 60 },
  { value: 'UTC+9:30', label: 'UTC+9:30（澳洲中部）', offsetMinutes: 9 * 60 + 30 },
  { value: 'UTC+10', label: 'UTC+10（澳洲东部）', offsetMinutes: 10 * 60 },
  { value: 'UTC+10:30', label: 'UTC+10:30（澳洲豪勋爵岛）', offsetMinutes: 10 * 60 + 30 },
  { value: 'UTC+7', label: 'UTC+7（泰国/越南）', offsetMinutes: 7 * 60 },
  { value: 'UTC+6', label: 'UTC+6（孟加拉附近）', offsetMinutes: 6 * 60 },
  { value: 'UTC+5:30', label: 'UTC+5:30（印度）', offsetMinutes: 5 * 60 + 30 },
  { value: 'UTC+5', label: 'UTC+5（巴基斯坦）', offsetMinutes: 5 * 60 },
  { value: 'UTC+4', label: 'UTC+4（阿联酋）', offsetMinutes: 4 * 60 },
  { value: 'UTC+3', label: 'UTC+3（莫斯科/沙特）', offsetMinutes: 3 * 60 },
  { value: 'UTC+2', label: 'UTC+2（东欧/南非）', offsetMinutes: 2 * 60 },
  { value: 'UTC+1', label: 'UTC+1（中欧）', offsetMinutes: 60 },
  { value: 'UTC+0', label: 'UTC+0（英国/葡萄牙）', offsetMinutes: 0 },
  { value: 'UTC-4', label: 'UTC-4（美国东部夏令时）', offsetMinutes: -4 * 60 },
  { value: 'UTC-5', label: 'UTC-5（美国东部）', offsetMinutes: -5 * 60 },
  { value: 'UTC-6', label: 'UTC-6（美国中部）', offsetMinutes: -6 * 60 },
  { value: 'UTC-7', label: 'UTC-7（美国山地）', offsetMinutes: -7 * 60 },
  { value: 'UTC-8', label: 'UTC-8（美国西部）', offsetMinutes: -8 * 60 }
];

const TARGET_UTC8_OFFSET_MINUTES = 8 * 60;

const pad = (value: number) => String(value).padStart(2, '0');

export const getTimezoneOffsetMinutes = (timezoneValue?: string): number =>
  TIMEZONE_OPTIONS.find((option) => option.value === timezoneValue)?.offsetMinutes ??
  TARGET_UTC8_OFFSET_MINUTES;

const formatShiftedDateTime = (utcMillis: number, offsetMinutes: number) => {
  const shifted = new Date(utcMillis + offsetMinutes * 60 * 1000);

  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
      shifted.getUTCDate()
    )}`,
    time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  };
};

const normalizeToUtc8 = (birthDate: string, birthTime: string, sourceOffsetMinutes: number) => {
  const [yearText, monthText, dayText] = birthDate.split('-');
  const [hourText, minuteText] = birthTime.split(':');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !year ||
    !month ||
    !day ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return {
      date: birthDate,
      time: birthTime
    };
  }

  const utcMillis =
    Date.UTC(year, month - 1, day, hour, minute) - sourceOffsetMinutes * 60 * 1000;

  return formatShiftedDateTime(utcMillis, TARGET_UTC8_OFFSET_MINUTES);
};

export const normalizeBirthProfileToUtc8 = (
  profile: UserProfileInput
): UserProfileInput => {
  const birthTimezone = profile.birthTimezone || 'UTC+8';
  const sourceOffsetMinutes = getTimezoneOffsetMinutes(birthTimezone);

  if (!profile.birthDate) {
    return {
      ...profile,
      birthTimezone,
      birthDateUtc8: '',
      birthDateLunarUtc8: '',
      birthTimeUtc8: profile.birthTime?.trim() || ''
    };
  }

  const isSolar = (profile.birthCalendarType || 'lunar') === 'solar';
  const sourceSolarDate = isSolar
    ? profile.birthDate
    : (() => {
        const lunarParts = parseStoredLunarDate(profile.birthDate, Boolean(profile.birthIsLeapMonth));
        return lunarParts ? convertLunarToSolar(lunarParts) : '';
      })();

  const sourceLunarLabel = isSolar
    ? (() => {
        try {
          return formatLunarDate(convertSolarToLunar(profile.birthDate));
        } catch {
          return profile.birthDateLunar || '';
        }
      })()
    : profile.birthDateLunar ||
      (() => {
        const lunarParts = parseStoredLunarDate(profile.birthDate, Boolean(profile.birthIsLeapMonth));
        return lunarParts ? formatLunarDate(lunarParts) : '';
      })();

  if (!sourceSolarDate) {
    return {
      ...profile,
      birthTimezone,
      birthDateLunar: sourceLunarLabel,
      birthDateUtc8: '',
      birthDateLunarUtc8: '',
      birthTimeUtc8: profile.birthTime?.trim() || ''
    };
  }

  const normalizedDateTime =
    profile.birthTime?.trim()
      ? normalizeToUtc8(sourceSolarDate, profile.birthTime.trim(), sourceOffsetMinutes)
      : {
          date: sourceSolarDate,
          time: ''
        };

  const normalizedLunar = formatLunarDate(convertSolarToLunar(normalizedDateTime.date));

  return {
    ...profile,
    birthTimezone,
    birthDateLunar: sourceLunarLabel,
    birthDateUtc8: normalizedDateTime.date,
    birthDateLunarUtc8: normalizedLunar,
    birthTimeUtc8: normalizedDateTime.time
  };
};
