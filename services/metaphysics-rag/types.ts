import type { ConsultationRecord, UserProfileInput } from '../../types/consultation';
import type { KnowledgeEvidence } from '../../types/knowledge';

export interface RagChunk {
  id: string;
  sourceFile: string;
  fileName: string;
  absolutePath: string;
  documentTitle: string;
  sectionTitle: string;
  pageHint?: string;
  topicTags: string[];
  content: string;
  chunkIndex: number;
  ingestTime: string;
  embedding: number[];
  tokens: string[];
}

export interface RagIndex {
  version: 1;
  generatedAt: string;
  sourceDirectories: string[];
  chunks: RagChunk[];
}

export interface RagManifestEntry {
  fileName: string;
  absolutePath: string;
  status: 'success' | 'failed';
  chunkCount: number;
  error: string | null;
  keyword: string;
}

export interface RagManifest {
  generatedAt: string;
  sourceDirectories: string[];
  scannedFiles: string[];
  processedFiles: RagManifestEntry[];
  failedFiles: RagManifestEntry[];
  totalChunkCount: number;
}

export interface RagSearchResult extends KnowledgeEvidence {
  fileName?: string;
  absolutePath?: string;
  snippet: string;
  ingestTime?: string;
  referencedYear?: number | null;
  timeReference?: 'past' | 'current' | 'future' | 'unknown';
  timeAdjustment?: {
    action: 'none' | 'downranked' | 'filtered_as_historical';
    reason?: string;
  };
}

export interface CurrentTimeContext {
  currentDate: string;
  currentYear: number;
  currentMonth: number;
  currentDay: number;
  timeZone: string;
  userQuestionTimeScope: 'today' | 'tomorrow' | 'this_year' | 'next_year' | 'specific_date' | 'unspecified';
}

export interface LoadedUserProfile {
  consultationId: string;
  profile: UserProfileInput;
}

export interface MetaphysicsContext {
  displayName: string;
  birthDate: string;
  birthDateLunar: string;
  birthTime: string;
  timezone: string;
  calendarType: UserProfileInput['birthCalendarType'];
  birthLocation: string;
  currentCity: string;
  normalizedBirthDateUtc8: string;
  normalizedBirthDateLunarUtc8: string;
  normalizedBirthTimeUtc8: string;
  bazi: {
    status: 'ready' | 'pending' | 'error';
    value: string;
    notes: string;
    pillars?: {
      year: string;
      month: string;
      day: string;
      hour: string;
    };
    wuxingSummary?: string;
    summary?: string;
  };
}

export interface SceneAnswerSection {
  icon: string;
  heading: string;
  content: string[];
}

export interface SceneAnswerShape {
  title: string;
  summary: string;
  metaphysics_basis: string;
  sections: SceneAnswerSection[];
  cautions: string[];
  closing: string;
}

export interface AnswerQuestionInput {
  consultation: ConsultationRecord;
  question: string;
  retrievedDocs: RagSearchResult[];
}
