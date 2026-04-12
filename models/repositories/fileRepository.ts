import path from 'node:path';
import { env } from '@/lib/env';
import { ensureFile, readJsonFile, writeJsonFile } from '@/lib/fs';

export class FileRepository<T extends { id: string }> {
  constructor(private readonly fileName: string, private readonly seedContent = '[]') {}

  private get filePath(): string {
    return path.join(env.dataDir, this.fileName);
  }

  async list(): Promise<T[]> {
    await ensureFile(this.filePath, this.seedContent);
    return readJsonFile<T[]>(this.filePath, []);
  }

  async getById(id: string): Promise<T | undefined> {
    const records = await this.list();
    return records.find((record) => record.id === id);
  }

  async upsert(record: T): Promise<T> {
    const records = await this.list();
    const existingIndex = records.findIndex((current) => current.id === record.id);

    if (existingIndex >= 0) {
      records.splice(existingIndex, 1, record);
    } else {
      records.push(record);
    }

    await writeJsonFile(this.filePath, records);
    return record;
  }

  async create(record: T): Promise<T> {
    const records = await this.list();
    records.push(record);
    await writeJsonFile(this.filePath, records);
    return record;
  }

  async findMany(predicate: (item: T) => boolean): Promise<T[]> {
    const records = await this.list();
    return records.filter(predicate);
  }
}
