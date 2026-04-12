import path from 'node:path';

const resolveFromRoot = (input: string | undefined, fallback: string) =>
  path.resolve(process.cwd(), input || fallback);

export const env = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  aiCompatApiKey: process.env.FORTUNE_AI_API_KEY || '',
  aiCompatBaseUrl: process.env.FORTUNE_AI_BASE_URL || '',
  aiCompatModel: process.env.FORTUNE_AI_MODEL || 'gpt-4o-mini',
  databasePath: resolveFromRoot(process.env.FORTUNE_DATABASE_PATH, './data/runtime/fortune_ai.db'),
  paymentAmountCents: Number(process.env.FORTUNE_PAYMENT_AMOUNT_CENTS || '19900'),
  demoUnlockAfterIntent: (process.env.DEMO_UNLOCK_AFTER_INTENT || 'true') === 'true',
  dataDir: resolveFromRoot(process.env.FORTUNE_DATA_DIR, './data/runtime'),
  uploadDir: resolveFromRoot(process.env.FORTUNE_UPLOAD_DIR, './uploads'),
  knowledgeDir: resolveFromRoot(process.env.FORTUNE_KNOWLEDGE_DIR, './knowledge/processed'),
  knowledgeSourceDir: resolveFromRoot(
    process.env.FORTUNE_KNOWLEDGE_SOURCE_DIR,
    './knowledgeFiles'
  )
};
