import type { CurrentTimeContext } from './types';

const runtimeTimeZone = 'Asia/Shanghai';

const getDateParts = (now: Date) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: runtimeTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const lookup = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    currentDate: `${lookup.year}-${lookup.month}-${lookup.day}`
  };
};

export const detectUserQuestionTimeScope = (
  question: string
): CurrentTimeContext['userQuestionTimeScope'] => {
  if (/明天/u.test(question)) {
    return 'tomorrow';
  }

  if (/今天|今日|现在|当前|目前/u.test(question)) {
    return 'today';
  }

  if (/明年|下年/u.test(question)) {
    return 'next_year';
  }

  if (/今年|本年/u.test(question)) {
    return 'this_year';
  }

  if (/\d{4}年|\d{1,2}月\d{1,2}日/u.test(question)) {
    return 'specific_date';
  }

  return 'unspecified';
};

export const buildCurrentTimeContext = (question: string, now = new Date()): CurrentTimeContext => {
  const dateParts = getDateParts(now);

  return {
    currentDate: dateParts.currentDate,
    currentYear: dateParts.year,
    currentMonth: dateParts.month,
    currentDay: dateParts.day,
    timeZone: runtimeTimeZone,
    userQuestionTimeScope: detectUserQuestionTimeScope(question)
  };
};
