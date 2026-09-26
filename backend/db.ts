import { Pool, PoolClient } from 'pg';

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

const globalPool = globalThis as typeof globalThis & { qitPool?: Pool; qitReady?: boolean };

function createPool(): Pool {
  const url = process.env.DATABASE_URL || process.env.QIT_DB_PATH || '';
  if (!url) throw new Error('DATABASE_URL is not set');
  return new Pool({ connectionString: url, max: 5, ssl: url.includes('railway') ? { rejectUnauthorized: false } : undefined });
}

export function getPool(): Pool {
  if (!globalPool.qitPool) globalPool.qitPool = createPool();
  return globalPool.qitPool;
}

export async function initDatabase(): Promise<void> {
  if (globalPool.qitReady) return;
  const pool = getPool();
  await pool.query(`
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      response_status INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      submission_id INTEGER NOT NULL,
      reviewer TEXT NOT NULL,
      feedback TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('changes_requested', 'approved')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS reviews_submission_idx ON reviews(submission_id);
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS proofs (
      hash TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  globalPool.qitReady = true;
}

/** Helper: run a query after ensuring DB is initialized */
export async function query(text: string, params?: any[]) {
  await initDatabase();
  return getPool().query(text, params);
}

/** Helper: get a single row */
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | undefined> {
  const result = await query(text, params);
  return result.rows[0] as T | undefined;
}

/** Helper: get all rows */
export async function queryAll<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await query(text, params);
  return result.rows as T[];
}
