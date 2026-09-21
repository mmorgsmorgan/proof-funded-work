import { getDatabase } from './db';

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Check if an idempotency key has already been processed. */
export function checkIdempotency(key: string): { hit: true; status: number; body: string } | null {
  const row = getDatabase()
    .prepare('SELECT response_status, response_body FROM idempotency_keys WHERE key = ?')
    .get(key) as { response_status: number; response_body: string } | undefined;
  if (!row) return null;
  return { hit: true, status: row.response_status, body: row.response_body };
}

/** Save a response for an idempotency key. */
export function saveIdempotency(key: string, status: number, body: string): void {
  getDatabase()
    .prepare('INSERT OR REPLACE INTO idempotency_keys (key, response_status, response_body, created_at) VALUES (?, ?, ?, ?)')
    .run(key, status, body, new Date().toISOString());
}

/** Remove expired idempotency keys older than maxAgeMs (default: 24h). */
export function cleanExpiredKeys(maxAgeMs: number = MAX_AGE_MS): void {
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  getDatabase().prepare('DELETE FROM idempotency_keys WHERE created_at < ?').run(cutoff);
}
