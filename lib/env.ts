import path from 'node:path';

const resolveFromRoot = (input: string | undefined, fallback: string) =>
  path.resolve(process.cwd(), input || fallback);

const resolveDirectoryList = (input: string | undefined, fallback: string): string[] => {
  const rawValues = input
    ? input
        .split(/[\n,]/u)
        .map((value) => value.trim())
        .filter(Boolean)
    : [fallback];

  return Array.from(new Set(rawValues.map((value) => path.resolve(process.cwd(), value))));
};

export const env = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  aiCompatApiKey: process.env.FORTUNE_AI_API_KEY || '',
  aiCompatBaseUrl: process.env.FORTUNE_AI_BASE_URL || '',
  aiCompatModel: process.env.FORTUNE_AI_MODEL || 'gpt-4o-mini',
  embeddingApiKey: process.env.FORTUNE_AI_EMBEDDING_API_KEY || process.env.FORTUNE_AI_API_KEY || '',
  embeddingBaseUrl:
    process.env.FORTUNE_AI_EMBEDDING_BASE_URL ||
    (process.env.FORTUNE_AI_BASE_URL
      ? process.env.FORTUNE_AI_BASE_URL.replace(/\/chat\/completions$/u, '/embeddings')
      : ''),
  embeddingModel: process.env.FORTUNE_AI_EMBEDDING_MODEL || 'text-embedding-3-small',
  databasePath: resolveFromRoot(process.env.FORTUNE_DATABASE_PATH, './data/runtime/fortune_ai.db'),
  paymentAmountCents: Number(process.env.FORTUNE_PAYMENT_AMOUNT_CENTS || '19900'),
  demoUnlockAfterIntent: (process.env.DEMO_UNLOCK_AFTER_INTENT || 'true') === 'true',
  dataDir: resolveFromRoot(process.env.FORTUNE_DATA_DIR, './data/runtime'),
  uploadDir: resolveFromRoot(process.env.FORTUNE_UPLOAD_DIR, './uploads'),
  knowledgeDir: resolveFromRoot(process.env.FORTUNE_KNOWLEDGE_DIR, './knowledge/processed'),
  knowledgeSourceDirs: resolveDirectoryList(
    process.env.FORTUNE_AI_KNOWLEDGE_DIRS,
    process.env.FORTUNE_KNOWLEDGE_SOURCE_DIR || './knowledgeFiles'
  ),
  ragIndexPath: resolveFromRoot(process.env.FORTUNE_RAG_INDEX_PATH, './data/runtime/rag-index.json'),
  ragManifestPath: resolveFromRoot(process.env.FORTUNE_RAG_MANIFEST_PATH, './data/runtime/rag-manifest.json'),
  ragVerifyPath: resolveFromRoot(process.env.FORTUNE_RAG_VERIFY_PATH, './data/runtime/rag-verify.json'),
  knowledgeSourceDir: resolveFromRoot(
    process.env.FORTUNE_KNOWLEDGE_SOURCE_DIR,
    './knowledgeFiles'
  )
};
