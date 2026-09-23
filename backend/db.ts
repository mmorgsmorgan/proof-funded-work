import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type AccountRole = 'worker' | 'task_giver';
export type AccountRecord = {
  id: string;
  privy_user_id: string;
  email: string;
  role: AccountRole;
  wallet_address: string;
  created_at: string;
  updated_at: string;
};

const globalDatabase = globalThis as typeof globalThis & { qitDatabase?: DatabaseSync };

function openDatabase() {
  const raw = process.env.QIT_DB_PATH || '';
  // Ignore database URLs — SQLite needs a file path, not a connection string
  const isUrl = raw.startsWith('postgresql') || raw.startsWith('postgres') || raw.startsWith('mysql');
  // On serverless (Vercel), only /tmp is writable
  const defaultPath = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? '/tmp/qit.sqlite'
    : join(process.cwd(), 'data', 'qit.sqlite');
  const filename = (raw && !isUrl) ? raw : defaultPath;
  mkdirSync(dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  database.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      privy_user_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('worker', 'task_giver')),
      wallet_address TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS accounts_email_idx ON accounts(email);
    CREATE INDEX IF NOT EXISTS accounts_wallet_idx ON accounts(wallet_address);
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      response_status INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return database;
}

export function getDatabase() {
  if (!globalDatabase.qitDatabase) globalDatabase.qitDatabase = openDatabase();
  return globalDatabase.qitDatabase;
}
