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
  const filename = process.env.QIT_DB_PATH || join(process.cwd(), 'data', 'qit.sqlite');
  mkdirSync(dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  database.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      privy_user_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('worker', 'task_giver')),
      wallet_address TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS accounts_email_idx ON accounts(email);
  `);
  return database;
}

export function getDatabase() {
  if (!globalDatabase.qitDatabase) globalDatabase.qitDatabase = openDatabase();
  return globalDatabase.qitDatabase;
}
