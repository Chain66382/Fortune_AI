import { Solar } from 'lunar-typescript';
import { normalizeBirthProfileToUtc8 } from '../../lib/timezones';
import type { UserProfileInput } from '../../types/consultation';

const ELEMENT_LABELS = ['木', '火', '土', '金', '水'] as const;

const countElements = (values: string[]) =>
  values.reduce<Record<string, number>>((counts, value) => {
    for (const element of ELEMENT_LABELS) {
      const matches = Array.from(value).filter((character) => character === element).length;

      if (matches > 0) {
        counts[element] = (counts[element] || 0) + matches;
      }
    }

    return counts;
  }, {});

const summarizeWuxing = (counts: Record<string, number>) => {
  const ordered = ELEMENT_LABELS.map((element) => ({
    element,
    count: counts[element] || 0
  })).sort((left, right) => right.count - left.count);

  const strongest = ordered.filter((item) => item.count === ordered[0].count && item.count > 0).map((item) => item.element);
  const weakest = ordered.filter((item) => item.count === ordered[ordered.length - 1].count).map((item) => item.element);

  return {
    counts,
    summary: `五行分布：${ordered.map((item) => `${item.element}${item.count}`).join('、')}。较旺：${strongest.join('、') || '未判定'}；较弱：${weakest.join('、') || '未判定'}。`
  };
};

export const normalizeBirthDateTimeToUtc8 = (profile: UserProfileInput) => normalizeBirthProfileToUtc8(profile);

export const generateBazi = (profile: UserProfileInput) => {
  const normalizedProfile = normalizeBirthDateTimeToUtc8(profile);

  if (!normalizedProfile.birthDateUtc8 && !normalizedProfile.birthDate) {
    return {
      status: 'pending' as const,
      value: '八字待生成',
      notes: '缺少出生日期，无法生成八字。'
    };
  }

  const normalizedDate = normalizedProfile.birthDateUtc8 || normalizedProfile.birthDate;
  const normalizedTime = normalizedProfile.birthTimeUtc8 || normalizedProfile.birthTime || '12:00';
  const [year, month, day] = normalizedDate.split('-').map(Number);
  const [hour, minute] = normalizedTime.split(':').map(Number);

  try {
    const solar = Solar.fromYmdHms(year, month, day, hour, minute || 0, 0);
    const eightChar = solar.getLunar().getEightChar();
    const pillars = {
      year: eightChar.getYear(),
      month: eightChar.getMonth(),
      day: eightChar.getDay(),
      hour: eightChar.getTime()
    };
    const wuxingValues = [
      eightChar.getYearWuXing(),
      eightChar.getMonthWuXing(),
      eightChar.getDayWuXing(),
      eightChar.getTimeWuXing()
    ];
    const wuxing = summarizeWuxing(countElements(wuxingValues));
    const summary = `年柱${pillars.year}、月柱${pillars.month}、日柱${pillars.day}、时柱${pillars.hour}。日主为${pillars.day[0]}，整体命理参考以 ${wuxing.summary} 为主。`;

    return {
      status: 'ready' as const,
      value: `${pillars.year} ${pillars.month} ${pillars.day} ${pillars.hour}`,
      notes: `已按 UTC+8 ${normalizedDate} ${normalizedTime} 参与排盘。`,
      pillars,
      wuxingSummary: wuxing.summary,
      summary
    };
  } catch (error) {
    return {
      status: 'error' as const,
      value: '八字生成失败',
      notes: error instanceof Error ? error.message : '未知错误，无法生成八字。'
    };
  }
};

export const summarizeBazi = (profile: UserProfileInput) => generateBazi(profile);
