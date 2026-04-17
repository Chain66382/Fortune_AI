import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { env } from '../../lib/env';
import { EmbeddingService } from '../ai/embeddingService';
import { extractTokens } from '../knowledge/scoring';
import type { RagChunk, RagIndex, RagManifest, RagManifestEntry } from './types';

const CHUNK_SIZE = 880;
const CHUNK_OVERLAP = 140;
const embeddingService = new EmbeddingService();

const toDocumentId = (fileName: string) =>
  fileName
    .toLowerCase()
    .replace(/\.pdf$/iu, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, '-')
    .replace(/^-+|-+$/g, '');

const splitIntoChunks = (content: string): string[] => {
  if (content.length <= CHUNK_SIZE) {
    return [content];
  }

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const chunk = content.slice(cursor, cursor + CHUNK_SIZE).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (cursor + CHUNK_SIZE >= content.length) {
      break;
    }

    cursor += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
};

const walkDirectory = async (directoryPath: string): Promise<string[]> => {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        return walkDirectory(absolutePath);
      }

      return entry.isFile() ? [absolutePath] : [];
    })
  );

  return files.flat();
};

export const discoverPdfFiles = async (sourceDirectories: string[]) => {
  const discovered = await Promise.all(
    sourceDirectories.map(async (sourceDirectory) => {
      const files = await walkDirectory(sourceDirectory).catch(() => []);
      return files.filter((filePath) => filePath.toLowerCase().endsWith('.pdf'));
    })
  );

  return Array.from(new Set(discovered.flat())).sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
};

const extractPdfText = async (absolutePath: string) => {
  const pdfBuffer = await fs.readFile(absolutePath);
  const parser = new PDFParse({ data: pdfBuffer });

  try {
    const parsed = await parser.getText();
    return parsed.text.replace(/\s+/g, ' ').trim();
  } finally {
    await parser.destroy();
  }
};

const createKeywordFromFileName = (fileName: string) =>
  fileName
    .replace(/\.pdf$/iu, '')
    .replace(/[\[\]（）()·\-—_]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

const buildChunkRecords = (
  absolutePath: string,
  fileName: string,
  extractedText: string,
  ingestTime: string
) => {
  const chunks = splitIntoChunks(extractedText);
  const documentTitle = createKeywordFromFileName(fileName);
  const documentId = toDocumentId(fileName);

  return chunks.map((content, chunkIndex) => ({
    id: `${documentId}_${chunkIndex + 1}`,
    sourceFile: fileName,
    fileName,
    absolutePath,
    documentTitle,
    sectionTitle: `${documentTitle} / 片段 ${chunkIndex + 1}`,
    pageHint: `pdf-chunk-${chunkIndex + 1}`,
    topicTags: extractTokens(`${documentTitle} ${content}`).slice(0, 12),
    content,
    chunkIndex,
    ingestTime,
    tokens: extractTokens(content),
    embeddingInput: `${documentTitle} ${content}`
  }));
};

const createManifestEntry = (
  absolutePath: string,
  status: 'success' | 'failed',
  chunkCount: number,
  error: string | null
): RagManifestEntry => ({
  fileName: path.basename(absolutePath),
  absolutePath,
  status,
  chunkCount,
  error,
  keyword: createKeywordFromFileName(path.basename(absolutePath))
});

export const ingestDocuments = async (): Promise<{ index: RagIndex; manifest: RagManifest }> => {
  const sourceDirectories = env.knowledgeSourceDirs;
  const scannedFiles = await discoverPdfFiles(sourceDirectories);

  if (scannedFiles.length === 0) {
    throw new Error(`No PDF files found in source directories: ${sourceDirectories.join(', ')}`);
  }

  const ingestTime = new Date().toISOString();
  const successfulEntries: RagManifestEntry[] = [];
  const failedEntries: RagManifestEntry[] = [];
  const chunkPayloads: Array<
    Omit<RagChunk, 'embedding'> & {
      embeddingInput: string;
    }
  > = [];

  for (const absolutePath of scannedFiles) {
    const fileName = path.basename(absolutePath);

    try {
      const extractedText = await extractPdfText(absolutePath);

      if (extractedText.length < 120) {
        failedEntries.push(createManifestEntry(absolutePath, 'failed', 0, 'Extracted text was too short.'));
        continue;
      }

      const chunks = buildChunkRecords(absolutePath, fileName, extractedText, ingestTime);
      chunkPayloads.push(...chunks);
      successfulEntries.push(createManifestEntry(absolutePath, 'success', chunks.length, null));
    } catch (error) {
      failedEntries.push(
        createManifestEntry(
          absolutePath,
          'failed',
          0,
          error instanceof Error ? error.message : 'Unknown PDF parsing error.'
        )
      );
    }
  }

  const embeddings = await embeddingService.embedTexts(chunkPayloads.map((chunk) => chunk.embeddingInput));
  const chunks: RagChunk[] = chunkPayloads.map((chunk, index) => ({
    id: chunk.id,
    sourceFile: chunk.sourceFile,
    fileName: chunk.fileName,
    absolutePath: chunk.absolutePath,
    documentTitle: chunk.documentTitle,
    sectionTitle: chunk.sectionTitle,
    pageHint: chunk.pageHint,
    topicTags: chunk.topicTags,
    content: chunk.content,
    chunkIndex: chunk.chunkIndex,
    ingestTime: chunk.ingestTime,
    tokens: chunk.tokens,
    embedding: embeddings[index]
  }));

  const index: RagIndex = {
    version: 1,
    generatedAt: ingestTime,
    sourceDirectories,
    chunks
  };

  const manifest: RagManifest = {
    generatedAt: ingestTime,
    sourceDirectories,
    scannedFiles,
    processedFiles: successfulEntries,
    failedFiles: failedEntries,
    totalChunkCount: chunks.length
  };

  await fs.mkdir(path.dirname(env.ragIndexPath), { recursive: true });
  await fs.writeFile(env.ragIndexPath, JSON.stringify(index, null, 2), 'utf8');
  await fs.writeFile(env.ragManifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return { index, manifest };
};

export const loadRagIndex = async (): Promise<RagIndex> => {
  try {
    const raw = await fs.readFile(env.ragIndexPath, 'utf8');
    return JSON.parse(raw) as RagIndex;
  } catch {
    const { index } = await ingestDocuments();
    return index;
  }
};
