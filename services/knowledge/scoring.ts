const SPACE_REGEX = /\s+/g;
const NON_TEXT_REGEX = /[^\p{Script=Han}\p{Letter}\p{Number}]+/gu;
const HAN_REGEX = /[\p{Script=Han}]/gu;

export const normalizeText = (input: string): string =>
  input.toLowerCase().replace(NON_TEXT_REGEX, ' ').replace(SPACE_REGEX, ' ').trim();

const getHanBigrams = (input: string): string[] => {
  const hanCharacters = Array.from(input.matchAll(HAN_REGEX), (match) => match[0]);

  if (hanCharacters.length < 2) {
    return hanCharacters;
  }

  const bigrams: string[] = [];

  for (let index = 0; index < hanCharacters.length - 1; index += 1) {
    bigrams.push(`${hanCharacters[index]}${hanCharacters[index + 1]}`);
  }

  return bigrams;
};

export const extractTokens = (input: string): string[] => {
  const normalized = normalizeText(input);
  const latinTokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  const hanTokens = getHanBigrams(input);

  return Array.from(new Set([...latinTokens, ...hanTokens]));
};

const countTokenMatches = (haystack: string, token: string): number => {
  if (!token) {
    return 0;
  }

  let count = 0;
  let searchIndex = 0;

  while (searchIndex >= 0) {
    searchIndex = haystack.indexOf(token, searchIndex);

    if (searchIndex >= 0) {
      count += 1;
      searchIndex += token.length;
    }
  }

  return count;
};

export const scoreContentAgainstTokens = (content: string, title: string, tokens: string[]): number => {
  const normalizedContent = normalizeText(content);
  const normalizedTitle = normalizeText(title);

  return tokens.reduce((score, token) => {
    const titleBoost = countTokenMatches(normalizedTitle, token) * 4;
    const contentScore = countTokenMatches(normalizedContent, token);
    return score + titleBoost + contentScore;
  }, 0);
};
