import { query, queryOne } from './db';

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Check if an idempotency key has already been processed. */
export async function checkIdempotency(key: string): Promise<{ hit: true; status: number; body: string } | null> {
  const row = await queryOne<{ response_status: number; response_body: string }>(
    'SELECT response_status, response_body FROM idempotency_keys WHERE key = $1', [key]
  );
  if (!row) return null;
  return { hit: true, status: row.response_status, body: row.response_body };
}

/** Save a response for an idempotency key. */
export async function saveIdempotency(key: string, status: number, body: string): Promise<void> {
  await query(
    `INSERT INTO idempotency_keys (key, response_status, response_body, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key) DO UPDATE SET response_status = $2, response_body = $3, created_at = $4`,
    [key, status, body, new Date().toISOString()]
  );
}

/** Remove expired idempotency keys older than maxAgeMs (default: 24h). */
export async function cleanExpiredKeys(maxAgeMs: number = MAX_AGE_MS): Promise<void> {
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  await query('DELETE FROM idempotency_keys WHERE created_at < $1', [cutoff]);
}
