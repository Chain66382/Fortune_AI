import { extractTokens } from '../knowledge/scoring';
import { EmbeddingService } from '../ai/embeddingService';
import { loadRagIndex } from './ingestDocuments';
import type { CurrentTimeContext, RagChunk, RagSearchResult } from './types';
import type { UserProfileInput } from '../../types/consultation';

const embeddingService = new EmbeddingService();

const cosineSimilarity = (left: number[], right: number[]): number =>
  left.reduce((sum, value, index) => sum + value * (right[index] || 0), 0);

const detectReferencedYear = (text: string): number | null => {
  const matches = text.match(/\b(20\d{2})年?\b/gu) || text.match(/(20\d{2})年/gu);

  if (!matches || matches.length === 0) {
    return null;
  }

  const normalized = matches
    .map((match) => Number(match.replace(/[^0-9]/gu, '')))
    .find((year) => year >= 2000 && year <= 2099);

  return normalized ?? null;
};

const classifyTimeReference = (
  referencedYear: number | null,
  currentYear: number
): RagSearchResult['timeReference'] => {
  if (!referencedYear) {
    return 'unknown';
  }

  if (referencedYear < currentYear) {
    return 'past';
  }

  if (referencedYear > currentYear) {
    return 'future';
  }

  return 'current';
};

const shouldApplyTimePenalty = (timeScope: CurrentTimeContext['userQuestionTimeScope']) =>
  timeScope === 'today' ||
  timeScope === 'tomorrow' ||
  timeScope === 'this_year' ||
  timeScope === 'next_year' ||
  timeScope === 'specific_date';

const buildQueryTokens = (profile: UserProfileInput, question: string): string[] => {
  const profileContext = [profile.focusArea, profile.currentChallenge, profile.dreamContext || '', profile.fengShuiContext || '']
    .join(' ')
    .trim();

  return Array.from(new Set([...extractTokens(question), ...extractTokens(profileContext)]));
};

const scoreChunk = (
  chunk: RagChunk,
  queryEmbedding: number[],
  queryTokens: string[],
  currentTimeContext?: CurrentTimeContext
) => {
  const vectorScore = cosineSimilarity(chunk.embedding, queryEmbedding);
  const keywordScore = queryTokens.reduce(
    (score, token) => score + (chunk.tokens.some((chunkToken) => chunkToken.includes(token) || token.includes(chunkToken)) ? 0.12 : 0),
    0
  );
  const referencedYear = detectReferencedYear(`${chunk.documentTitle} ${chunk.sectionTitle} ${chunk.content}`);
  const timeReference = currentTimeContext
    ? classifyTimeReference(referencedYear, currentTimeContext.currentYear)
    : 'unknown';
  let adjustedScore = vectorScore + keywordScore;
  let timeAdjustment: RagSearchResult['timeAdjustment'] = { action: 'none' };

  if (
    currentTimeContext &&
    referencedYear &&
    timeReference === 'past' &&
    shouldApplyTimePenalty(currentTimeContext.userQuestionTimeScope)
  ) {
    adjustedScore -= 0.28;
    timeAdjustment = {
      action: 'downranked',
      reason: `Referenced year ${referencedYear} is older than current year ${currentTimeContext.currentYear}.`
    };
  }

  return {
    adjustedScore: Number(adjustedScore.toFixed(6)),
    referencedYear,
    timeReference,
    timeAdjustment
  };
};

export const retrieveKnowledge = async (
  profile: UserProfileInput,
  question: string,
  topK = 6,
  currentTimeContext?: CurrentTimeContext
): Promise<RagSearchResult[]> => {
  const index = await loadRagIndex();
  const queryEmbedding = await embeddingService.embedText(question);
  const queryTokens = buildQueryTokens(profile, question);

  const ranked = index.chunks
    .map((chunk) => ({
      chunk,
      scoring: scoreChunk(chunk, queryEmbedding, queryTokens, currentTimeContext)
    }))
    .sort((left, right) => right.scoring.adjustedScore - left.scoring.adjustedScore)
    .slice(0, topK);

  return ranked.map(({ chunk, scoring }) => ({
    id: chunk.id,
    sourceFile: chunk.sourceFile,
    fileName: chunk.fileName,
    absolutePath: chunk.absolutePath,
    sectionTitle: chunk.sectionTitle,
    pageHint: chunk.pageHint,
    content: chunk.content,
    relevanceScore: scoring.adjustedScore,
    snippet: chunk.content.slice(0, 180),
    ingestTime: chunk.ingestTime,
    referencedYear: scoring.referencedYear,
    timeReference: scoring.timeReference,
    timeAdjustment: scoring.timeAdjustment
  }));
};
