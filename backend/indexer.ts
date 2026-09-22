import { createPublicClient, http, parseAbiItem, formatUnits } from 'viem';
import { arcTestnet, ESCROW_ADDRESS, ESCROW_ABI } from '../lib/arc';
import { logger } from './logger';
import { getDatabase } from './db';

/**
 * On-chain event indexer for FundedWorkEscrow.
 * Watches contract events and caches job/submission state in SQLite
 * so the frontend doesn't need to hammer the RPC for every page load.
 */

// Ensure cache tables exist
function ensureCacheTables() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS cached_jobs (
      id INTEGER PRIMARY KEY,
      client TEXT NOT NULL,
      reward_per_task TEXT NOT NULL,
      total_tasks INTEGER NOT NULL,
      verified_tasks INTEGER NOT NULL DEFAULT 0,
      deadline INTEGER NOT NULL,
      status INTEGER NOT NULL DEFAULT 1,
      metadata_uri TEXT NOT NULL DEFAULT '',
      budget TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS cached_jobs_client_idx ON cached_jobs(client);
    CREATE INDEX IF NOT EXISTS cached_jobs_status_idx ON cached_jobs(status);
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS cached_submissions (
      id INTEGER PRIMARY KEY,
      job_id INTEGER NOT NULL,
      worker TEXT NOT NULL,
      submitted_tasks INTEGER NOT NULL,
      approved_tasks INTEGER NOT NULL DEFAULT 0,
      proof_hash TEXT NOT NULL,
      reviewed INTEGER NOT NULL DEFAULT 0,
      payout TEXT NOT NULL DEFAULT '0',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES cached_jobs(id)
    );
    CREATE INDEX IF NOT EXISTS cached_submissions_job_idx ON cached_submissions(job_id);
    CREATE INDEX IF NOT EXISTS cached_submissions_worker_idx ON cached_submissions(worker);
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS indexer_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// Get/set the last indexed block
function getLastBlock(): bigint {
  const row = getDatabase()
    .prepare('SELECT value FROM indexer_state WHERE key = ?')
    .get('last_block') as { value: string } | undefined;
  return row ? BigInt(row.value) : 0n;
}

function setLastBlock(block: bigint) {
  getDatabase()
    .prepare('INSERT OR REPLACE INTO indexer_state (key, value) VALUES (?, ?)')
    .run('last_block', block.toString());
}

// Event handlers
function handleJobCreated(args: { jobId: bigint; client: string; totalTasks: bigint; rewardPerTask: bigint; budget: bigint }, blockNumber: bigint) {
  const now = new Date().toISOString();
  getDatabase().prepare(`
    INSERT OR REPLACE INTO cached_jobs (id, client, reward_per_task, total_tasks, verified_tasks, deadline, status, metadata_uri, budget, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, 0, 1, '', ?, ?, ?)
  `).run(
    Number(args.jobId),
    args.client.toLowerCase(),
    args.rewardPerTask.toString(),
    Number(args.totalTasks),
    args.budget.toString(),
    now,
    now,
  );
  logger.info('indexed_job_created', { jobId: Number(args.jobId), client: args.client, budget: formatUnits(args.budget, 6), block: Number(blockNumber) });
}

function handleWorkSubmitted(args: { submissionId: bigint; jobId: bigint; worker: string; submittedTasks: bigint; proofHash: string }, blockNumber: bigint) {
  const now = new Date().toISOString();
  getDatabase().prepare(`
    INSERT OR REPLACE INTO cached_submissions (id, job_id, worker, submitted_tasks, approved_tasks, proof_hash, reviewed, payout, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, 0, '0', ?, ?)
  `).run(
    Number(args.submissionId),
    Number(args.jobId),
    args.worker.toLowerCase(),
    Number(args.submittedTasks),
    args.proofHash,
    now,
    now,
  );
  logger.info('indexed_work_submitted', { submissionId: Number(args.submissionId), jobId: Number(args.jobId), worker: args.worker, block: Number(blockNumber) });
}

function handleWorkVerified(args: { submissionId: bigint; jobId: bigint; worker: string; approvedTasks: bigint; payout: bigint }, blockNumber: bigint) {
  const now = new Date().toISOString();
  getDatabase().prepare(`
    UPDATE cached_submissions SET approved_tasks = ?, reviewed = 1, payout = ?, updated_at = ? WHERE id = ?
  `).run(Number(args.approvedTasks), args.payout.toString(), now, Number(args.submissionId));

  // Update job verified count
  getDatabase().prepare(`
    UPDATE cached_jobs SET verified_tasks = verified_tasks + ?, updated_at = ? WHERE id = ?
  `).run(Number(args.approvedTasks), now, Number(args.jobId));

  logger.info('indexed_work_verified', { submissionId: Number(args.submissionId), jobId: Number(args.jobId), payout: formatUnits(args.payout, 6), block: Number(blockNumber) });
}

function handleJobCancelled(args: { jobId: bigint; refund: bigint }, blockNumber: bigint) {
  const now = new Date().toISOString();
  getDatabase().prepare(`
    UPDATE cached_jobs SET status = 3, updated_at = ? WHERE id = ?
  `).run(now, Number(args.jobId));
  logger.info('indexed_job_cancelled', { jobId: Number(args.jobId), refund: formatUnits(args.refund, 6), block: Number(blockNumber) });
}

// Query helpers for the frontend
export function getCachedJobs(filters?: { client?: string; status?: number }) {
  let query = 'SELECT * FROM cached_jobs';
  const params: (string | number)[] = [];
  const conditions: string[] = [];
  if (filters?.client) { conditions.push('client = ?'); params.push(filters.client.toLowerCase()); }
  if (filters?.status !== undefined) { conditions.push('status = ?'); params.push(filters.status); }
  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY id DESC';
  return getDatabase().prepare(query).all(...params);
}

export function getCachedSubmissions(filters?: { jobId?: number; worker?: string }) {
  let query = 'SELECT * FROM cached_submissions';
  const params: (string | number)[] = [];
  const conditions: string[] = [];
  if (filters?.jobId !== undefined) { conditions.push('job_id = ?'); params.push(filters.jobId); }
  if (filters?.worker) { conditions.push('worker = ?'); params.push(filters.worker.toLowerCase()); }
  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY id DESC';
  return getDatabase().prepare(query).all(...params);
}

/**
 * Poll for new events from the last indexed block.
 * Call this on a timer (e.g. every 10 seconds) or on page load.
 */
export async function syncEvents() {
  ensureCacheTables();
  const client = createPublicClient({ chain: arcTestnet, transport: http() });
  const fromBlock = getLastBlock() + 1n;
  const currentBlock = await client.getBlockNumber();

  if (fromBlock > currentBlock) return { synced: false, fromBlock: Number(fromBlock), toBlock: Number(currentBlock) };

  const logs = await client.getLogs({
    address: ESCROW_ADDRESS,
    fromBlock,
    toBlock: currentBlock,
    events: [
      parseAbiItem('event JobCreated(uint256 indexed jobId, address indexed client, uint256 totalTasks, uint256 rewardPerTask, uint256 budget)'),
      parseAbiItem('event WorkSubmitted(uint256 indexed submissionId, uint256 indexed jobId, address indexed worker, uint256 submittedTasks, bytes32 proofHash)'),
      parseAbiItem('event WorkVerified(uint256 indexed submissionId, uint256 indexed jobId, address indexed worker, uint256 approvedTasks, uint256 payout)'),
      parseAbiItem('event JobCancelled(uint256 indexed jobId, uint256 refund)'),
    ],
  });

  for (const log of logs) {
    const bn = log.blockNumber ?? currentBlock;
    switch (log.eventName) {
      case 'JobCreated': handleJobCreated(log.args as any, bn); break;
      case 'WorkSubmitted': handleWorkSubmitted(log.args as any, bn); break;
      case 'WorkVerified': handleWorkVerified(log.args as any, bn); break;
      case 'JobCancelled': handleJobCancelled(log.args as any, bn); break;
    }
  }

  setLastBlock(currentBlock);
  logger.info('sync_complete', { fromBlock: Number(fromBlock), toBlock: Number(currentBlock), events: logs.length });
  return { synced: true, fromBlock: Number(fromBlock), toBlock: Number(currentBlock), events: logs.length };
}
