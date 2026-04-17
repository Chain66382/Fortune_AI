import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../lib/env';
import { loadRagIndex } from './ingestDocuments';
import { retrieveKnowledge } from './retrieveKnowledge';
import type { RagManifest, RagSearchResult } from './types';
import type { UserProfileInput } from '../../types/consultation';

interface RagVerificationEntry {
  fileName: string;
  absolutePath: string;
  keyword: string;
  matched: boolean;
  matchedSourceFile: string | null;
  topResultSourceFiles: string[];
  topResultSnippet: string | null;
}

export interface RagVerificationReport {
  generatedAt: string;
  manifestPath: string;
  totalProcessedFiles: number;
  matchedFileCount: number;
  failedFileCount: number;
  results: RagVerificationEntry[];
}

const verificationProfile: UserProfileInput = {
  displayName: '知识库验证',
  gender: 'prefer_not_to_say',
  birthDate: '1990-01-01',
  birthCalendarType: 'solar',
  birthDateLunar: '农历 1989年腊月初五',
  birthTime: '08:00',
  birthTimezone: 'UTC+8',
  birthLocation: '北京',
  currentCity: '北京',
  focusArea: 'overall',
  currentChallenge: '验证知识库检索命中',
  dreamContext: '',
  fengShuiContext: '',
  uploadedAssets: []
};

const loadManifest = async (): Promise<RagManifest | null> => {
  try {
    const raw = await fs.readFile(env.ragManifestPath, 'utf8');
    return JSON.parse(raw) as RagManifest;
  } catch {
    return null;
  }
};

const summarizeRetrieval = (results: RagSearchResult[]) => ({
  topResultSourceFiles: results.map((result) => result.sourceFile),
  topResultSnippet: results[0]?.snippet ?? null
});

export const verifyRagSources = async (): Promise<RagVerificationReport> => {
  const index = await loadRagIndex();
  const manifest = await loadManifest();
  const fallbackProcessedFiles = Array.from(
    index.chunks.reduce((entries, chunk) => {
      if (!entries.has(chunk.sourceFile)) {
        entries.set(chunk.sourceFile, {
          fileName: chunk.fileName,
          absolutePath: chunk.absolutePath,
          status: 'success' as const,
          chunkCount: 0,
          error: null,
          keyword: chunk.documentTitle
        });
      }

      entries.get(chunk.sourceFile)!.chunkCount += 1;
      return entries;
    }, new Map<string, RagManifest['processedFiles'][number]>())
  ).map(([, entry]) => entry);
  const successfulFiles =
    manifest?.processedFiles.filter((entry) => entry.status === 'success').length
      ? manifest.processedFiles.filter((entry) => entry.status === 'success')
      : fallbackProcessedFiles;
  const results: RagVerificationEntry[] = [];

  for (const entry of successfulFiles) {
    const referenceChunk = index.chunks.find((chunk) => chunk.sourceFile === entry.fileName);
    const verificationQuery = [entry.keyword, referenceChunk?.documentTitle || '', referenceChunk?.content.slice(0, 80) || '']
      .filter(Boolean)
      .join(' ');
    const retrieved = await retrieveKnowledge(verificationProfile, verificationQuery, 8);
    const matched = retrieved.some((result) => result.sourceFile === entry.fileName);
    const topMatch = retrieved.find((result) => result.sourceFile === entry.fileName) ?? retrieved[0] ?? null;

    results.push({
      fileName: entry.fileName,
      absolutePath: entry.absolutePath,
      keyword: verificationQuery,
      matched,
      matchedSourceFile: topMatch?.sourceFile ?? null,
      ...summarizeRetrieval(retrieved)
    });
  }

  const report: RagVerificationReport = {
    generatedAt: new Date().toISOString(),
    manifestPath: manifest ? env.ragManifestPath : `${env.ragManifestPath} (fallback to index)`,
    totalProcessedFiles: successfulFiles.length,
    matchedFileCount: results.filter((entry) => entry.matched).length,
    failedFileCount: results.filter((entry) => !entry.matched).length,
    results
  };

  await fs.mkdir(path.dirname(env.ragVerifyPath), { recursive: true });
  await fs.writeFile(env.ragVerifyPath, JSON.stringify(report, null, 2), 'utf8');

  return report;
};
