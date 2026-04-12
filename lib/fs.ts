import fs from 'node:fs/promises';
import path from 'node:path';

export const ensureDirectory = async (directoryPath: string): Promise<void> => {
  await fs.mkdir(directoryPath, { recursive: true });
};

export const ensureFile = async (filePath: string, initialContent: string): Promise<void> => {
  await ensureDirectory(path.dirname(filePath));
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, initialContent, 'utf8');
  }
};

export const readJsonFile = async <T>(filePath: string, fallbackValue: T): Promise<T> => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return fallbackValue;
  }
};

export const writeJsonFile = async <T>(filePath: string, value: T): Promise<void> => {
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
};
