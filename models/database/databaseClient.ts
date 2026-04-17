import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { env } from '@/lib/env';

interface TableColumnInfo {
  name: string;
}

export class DatabaseClient {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  get connection(): Database.Database {
    return this.db;
  }

  private ensureColumn(tableName: string, columnDefinition: string): void {
    const columnName = columnDefinition.split(' ')[0];
    const columns = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as TableColumnInfo[];

    if (!columns.some((column) => column.name === columnName)) {
      this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
    }
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        contact_type TEXT NOT NULL,
        contact_value TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        consultation_credits INTEGER NOT NULL DEFAULT 0,
        membership_plan TEXT,
        membership_expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS consultations (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        status TEXT NOT NULL,
        save_preference TEXT NOT NULL,
        unlocked INTEGER NOT NULL,
        free_turns_used INTEGER NOT NULL DEFAULT 0,
        paid_at TEXT,
        profile_json TEXT NOT NULL,
        initial_question TEXT,
        preview_answer_json TEXT,
        locked_report_outline_json TEXT,
        report_json TEXT,
        last_evidence_json TEXT,
        order_intent_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        consultation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        headline TEXT,
        content TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        debug_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        consultation_id TEXT NOT NULL,
        user_id TEXT,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'wechat_pay',
        plan_code TEXT NOT NULL DEFAULT 'consultation_pack_1000',
        plan_name TEXT NOT NULL DEFAULT '1000 次咨询',
        consultation_credits_granted INTEGER NOT NULL DEFAULT 0,
        membership_expires_at TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        paid_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    this.ensureColumn('users', 'consultation_credits INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('users', 'membership_plan TEXT');
    this.ensureColumn('users', 'membership_expires_at TEXT');
    this.ensureColumn('messages', 'debug_json TEXT');
    this.ensureColumn('payments', "payment_method TEXT NOT NULL DEFAULT 'wechat_pay'");
    this.ensureColumn('payments', "plan_code TEXT NOT NULL DEFAULT 'consultation_pack_1000'");
    this.ensureColumn('payments', "plan_name TEXT NOT NULL DEFAULT '1000 次咨询'");
    this.ensureColumn('payments', 'consultation_credits_granted INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('payments', 'membership_expires_at TEXT');
  }
}

let databaseClient: DatabaseClient | null = null;

export const getDatabaseClient = (): DatabaseClient => {
  if (!databaseClient) {
    databaseClient = new DatabaseClient(env.databasePath);
  }

  return databaseClient;
};
