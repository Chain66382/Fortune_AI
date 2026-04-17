import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = process.cwd();

const loadEnvFile = async (fileName: string) => {
  const filePath = path.resolve(projectRoot, fileName);

  try {
    const raw = await fs.readFile(filePath, 'utf8');

    for (const line of raw.split('\n')) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore missing local env files.
  }
};

const main = async () => {
  await loadEnvFile('.env.local');
  await loadEnvFile('.env');

  const envModuleUrl = pathToFileURL(path.join(projectRoot, 'lib/env.ts')).href;
  const ingestModuleUrl = pathToFileURL(path.join(projectRoot, 'services/metaphysics-rag/ingestDocuments.ts')).href;

  const [{ env }, { ingestDocuments }] = await Promise.all([import(envModuleUrl), import(ingestModuleUrl)]);

  const { index, manifest } = await ingestDocuments();

  console.log(
    JSON.stringify(
      {
        generatedAt: manifest.generatedAt,
        sourceDirectories: env.knowledgeSourceDirs,
        scannedFileCount: manifest.scannedFiles.length,
        processedFileCount: manifest.processedFiles.length,
        failedFileCount: manifest.failedFiles.length,
        totalChunkCount: manifest.totalChunkCount,
        ragIndexPath: env.ragIndexPath,
        ragManifestPath: env.ragManifestPath,
        files: [...manifest.processedFiles, ...manifest.failedFiles].map((entry) => ({
          fileName: entry.fileName,
          status: entry.status,
          chunkCount: entry.chunkCount,
          error: entry.error
        })),
        version: index.version
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
