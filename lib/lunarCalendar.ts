import { AppError } from '@/services/errors';

const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63
] as const;

const BASE_SOLAR_DATE = Date.UTC(1900, 0, 31);
const MIN_SUPPORTED_YEAR = 1900;
const MAX_SUPPORTED_YEAR = 2049;
const lunarMonthLabels = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '腊'] as const;
const lunarDayLabels = [
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十'
] as const;

export interface LunarDateParts {
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
}

const pad = (value: number): string => String(value).padStart(2, '0');

const assertSupportedYear = (year: number) => {
  if (year < MIN_SUPPORTED_YEAR || year > MAX_SUPPORTED_YEAR) {
    throw new AppError(`Birth year must be between ${MIN_SUPPORTED_YEAR} and ${MAX_SUPPORTED_YEAR}.`);
  }
};

const getYearIndex = (year: number): number => {
  assertSupportedYear(year);
  return year - MIN_SUPPORTED_YEAR;
};

const getLeapMonth = (year: number): number => LUNAR_INFO[getYearIndex(year)] & 0xf;

const getLeapMonthDays = (year: number): number =>
  getLeapMonth(year) ? ((LUNAR_INFO[getYearIndex(year)] & 0x10000) !== 0 ? 30 : 29) : 0;

const getMonthDays = (year: number, month: number): number =>
  (LUNAR_INFO[getYearIndex(year)] & (0x10000 >> month)) !== 0 ? 30 : 29;

const getLunarYearDays = (year: number): number => {
  let sum = 348;

  for (let bit = 0x8000; bit > 0x8; bit >>= 1) {
    sum += LUNAR_INFO[getYearIndex(year)] & bit ? 1 : 0;
  }

  return sum + getLeapMonthDays(year);
};

export const formatLunarDate = ({
  year,
  month,
  day,
  isLeapMonth
}: LunarDateParts): string => {
  assertSupportedYear(year);

  return `农历 ${year}年${isLeapMonth ? '闰' : ''}${lunarMonthLabels[month - 1]}月${lunarDayLabels[day - 1]}`;
};

export const parseStoredLunarDate = (
  birthDate: string,
  birthIsLeapMonth = false
): LunarDateParts | null => {
  if (!birthDate) {
    return null;
  }

  const [yearText, monthText, dayText] = birthDate.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) {
    return null;
  }

  return {
    year,
    month,
    day,
    isLeapMonth: birthIsLeapMonth
  };
};

export const convertSolarToLunar = (birthDate: string): LunarDateParts => {
  const target = new Date(`${birthDate}T00:00:00Z`);

  if (Number.isNaN(target.getTime())) {
    throw new AppError('Birth date is invalid.');
  }

  const targetYear = target.getUTCFullYear();
  assertSupportedYear(targetYear);

  let offset = Math.floor((target.getTime() - BASE_SOLAR_DATE) / 86400000);
  let lunarYear = MIN_SUPPORTED_YEAR;
  let tempDays = 0;

  for (let year = MIN_SUPPORTED_YEAR; year <= MAX_SUPPORTED_YEAR && offset > 0; year += 1) {
    tempDays = getLunarYearDays(year);
    offset -= tempDays;
    lunarYear = year;
  }

  if (offset < 0) {
    offset += tempDays;
  } else if (offset === 0 && lunarYear < MAX_SUPPORTED_YEAR) {
    tempDays = getLunarYearDays(lunarYear + 1);
  }

  const leapMonth = getLeapMonth(lunarYear);
  let lunarMonth = 1;
  let isLeapMonth = false;

  for (let month = 1; month <= 12 && offset > 0; month += 1) {
    if (leapMonth > 0 && month === leapMonth + 1 && !isLeapMonth) {
      month -= 1;
      isLeapMonth = true;
      tempDays = getLeapMonthDays(lunarYear);
    } else {
      tempDays = getMonthDays(lunarYear, month);
    }

    offset -= tempDays;

    if (isLeapMonth && month === leapMonth + 1) {
      isLeapMonth = false;
    }

    lunarMonth = month;
  }

  if (offset === 0 && leapMonth > 0 && lunarMonth === leapMonth + 1) {
    if (isLeapMonth) {
      isLeapMonth = false;
    } else {
      isLeapMonth = true;
      lunarMonth -= 1;
    }
  }

  if (offset < 0) {
    offset += tempDays;
  }

  return {
    year: lunarYear,
    month: lunarMonth,
    day: offset + 1,
    isLeapMonth
  };
};

export const convertLunarToSolar = ({
  year,
  month,
  day,
  isLeapMonth
}: LunarDateParts): string => {
  assertSupportedYear(year);

  if (month < 1 || month > 12 || day < 1 || day > 30) {
    throw new AppError('Birth date is invalid.');
  }

  const leapMonth = getLeapMonth(year);

  if (isLeapMonth && leapMonth !== month) {
    throw new AppError('Birth date is invalid.');
  }

  const maxDay = getLunarDayCount(year, month, isLeapMonth);

  if (day > maxDay) {
    throw new AppError('Birth date is invalid.');
  }

  let offset = 0;

  for (let currentYear = MIN_SUPPORTED_YEAR; currentYear < year; currentYear += 1) {
    offset += getLunarYearDays(currentYear);
  }

  for (let currentMonth = 1; currentMonth < month; currentMonth += 1) {
    offset += getMonthDays(year, currentMonth);

    if (leapMonth === currentMonth) {
      offset += getLeapMonthDays(year);
    }
  }

  if (isLeapMonth) {
    offset += getMonthDays(year, month);
  }

  offset += day - 1;

  const solarDate = new Date(BASE_SOLAR_DATE + offset * 86400000);

  return `${solarDate.getUTCFullYear()}-${pad(solarDate.getUTCMonth() + 1)}-${pad(
    solarDate.getUTCDate()
  )}`;
};

export const getLunarMonthOptions = (
  year: number
): Array<{ value: string; label: string; month: number; isLeapMonth: boolean }> => {
  assertSupportedYear(year);
  const leapMonth = getLeapMonth(year);
  const options: Array<{ value: string; label: string; month: number; isLeapMonth: boolean }> = [];

  for (let month = 1; month <= 12; month += 1) {
    options.push({
      value: String(month),
      label: `${lunarMonthLabels[month - 1]}月`,
      month,
      isLeapMonth: false
    });

    if (leapMonth === month) {
      options.push({
        value: `leap-${month}`,
        label: `闰${lunarMonthLabels[month - 1]}月`,
        month,
        isLeapMonth: true
      });
    }
  }

  return options;
};

export const getLunarDayCount = (year: number, month: number, isLeapMonth: boolean): number => {
  assertSupportedYear(year);
  return isLeapMonth ? getLeapMonthDays(year) : getMonthDays(year, month);
};

export const getSupportedBirthYears = (): number[] => {
  const currentYear = Math.min(new Date().getFullYear(), MAX_SUPPORTED_YEAR);
  const years: number[] = [];

  for (let year = currentYear; year >= MIN_SUPPORTED_YEAR; year -= 1) {
    years.push(year);
  }

  return years;
};

export const buildStoredLunarDate = (year: number, month: number, day: number): string =>
  `${year}-${pad(month)}-${pad(day)}`;
