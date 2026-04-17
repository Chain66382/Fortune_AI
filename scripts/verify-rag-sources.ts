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
  const verifyModuleUrl = pathToFileURL(path.join(projectRoot, 'services/metaphysics-rag/verifyRagSources.ts')).href;

  const [{ env }, { verifyRagSources }] = await Promise.all([import(envModuleUrl), import(verifyModuleUrl)]);

  const report = await verifyRagSources();

  console.log(
    JSON.stringify(
      {
        generatedAt: report.generatedAt,
        manifestPath: report.manifestPath,
        verifyReportPath: env.ragVerifyPath,
        totalProcessedFiles: report.totalProcessedFiles,
        matchedFileCount: report.matchedFileCount,
        failedFileCount: report.failedFileCount,
        results: report.results
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
