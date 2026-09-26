import { createPublicClient, http, parseAbiItem, formatUnits } from 'viem';
import { arcTestnet, ESCROW_ADDRESS } from '../lib/arc';
import { logger } from './logger';
import { query, queryOne, queryAll } from './db';

/**
 * On-chain event indexer for FundedWorkEscrow.
 * Watches contract events and caches job/submission state in PostgreSQL
 * so the frontend doesn't need to hammer the RPC for every page load.
 */

// Ensure cache tables exist
async function ensureCacheTables() {
  await query(`
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
  `);
  await query(`CREATE INDEX IF NOT EXISTS cached_jobs_client_idx ON cached_jobs(client);`);
  await query(`CREATE INDEX IF NOT EXISTS cached_jobs_status_idx ON cached_jobs(status);`);

  await query(`
    CREATE TABLE IF NOT EXISTS cached_submissions (
      id INTEGER PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES cached_jobs(id),
      worker TEXT NOT NULL,
      submitted_tasks INTEGER NOT NULL,
      approved_tasks INTEGER NOT NULL DEFAULT 0,
      proof_hash TEXT NOT NULL,
      reviewed BOOLEAN NOT NULL DEFAULT FALSE,
      payout TEXT NOT NULL DEFAULT '0',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS cached_submissions_job_idx ON cached_submissions(job_id);`);
  await query(`CREATE INDEX IF NOT EXISTS cached_submissions_worker_idx ON cached_submissions(worker);`);

  await query(`
    CREATE TABLE IF NOT EXISTS indexer_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// Get/set the last indexed block
async function getLastBlock(): Promise<bigint> {
  const row = await queryOne<{ value: string }>('SELECT value FROM indexer_state WHERE key = $1', ['last_block']);
  return row ? BigInt(row.value) : 0n;
}

async function setLastBlock(block: bigint) {
  await query(
    'INSERT INTO indexer_state (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
    ['last_block', block.toString()]
  );
}

// Event handlers
async function handleJobCreated(args: { jobId: bigint; client: string; totalTasks: bigint; rewardPerTask: bigint; budget: bigint }, blockNumber: bigint) {
  const now = new Date().toISOString();
  await query(`
    INSERT INTO cached_jobs (id, client, reward_per_task, total_tasks, verified_tasks, deadline, status, metadata_uri, budget, created_at, updated_at)
    VALUES ($1, $2, $3, $4, 0, 0, 1, '', $5, $6, $7)
    ON CONFLICT (id) DO UPDATE SET client = EXCLUDED.client, reward_per_task = EXCLUDED.reward_per_task, total_tasks = EXCLUDED.total_tasks, budget = EXCLUDED.budget, updated_at = EXCLUDED.updated_at
  `, [
    Number(args.jobId),
    args.client.toLowerCase(),
    args.rewardPerTask.toString(),
    Number(args.totalTasks),
    args.budget.toString(),
    now,
    now,
  ]);
  logger.info('indexed_job_created', { jobId: Number(args.jobId), client: args.client, budget: formatUnits(args.budget, 6), block: Number(blockNumber) });
}

async function handleWorkSubmitted(args: { submissionId: bigint; jobId: bigint; worker: string; submittedTasks: bigint; proofHash: string }, blockNumber: bigint) {
  const now = new Date().toISOString();
  await query(`
    INSERT INTO cached_submissions (id, job_id, worker, submitted_tasks, approved_tasks, proof_hash, reviewed, payout, created_at, updated_at)
    VALUES ($1, $2, $3, $4, 0, $5, FALSE, '0', $6, $7)
    ON CONFLICT (id) DO UPDATE SET worker = EXCLUDED.worker, submitted_tasks = EXCLUDED.submitted_tasks, proof_hash = EXCLUDED.proof_hash, updated_at = EXCLUDED.updated_at
  `, [
    Number(args.submissionId),
    Number(args.jobId),
    args.worker.toLowerCase(),
    Number(args.submittedTasks),
    args.proofHash,
    now,
    now,
  ]);
  logger.info('indexed_work_submitted', { submissionId: Number(args.submissionId), jobId: Number(args.jobId), worker: args.worker, block: Number(blockNumber) });
}

async function handleWorkVerified(args: { submissionId: bigint; jobId: bigint; worker: string; approvedTasks: bigint; payout: bigint }, blockNumber: bigint) {
  const now = new Date().toISOString();
  await query(`
    UPDATE cached_submissions SET approved_tasks = $1, reviewed = TRUE, payout = $2, updated_at = $3 WHERE id = $4
  `, [Number(args.approvedTasks), args.payout.toString(), now, Number(args.submissionId)]);

  // Update job verified count
  await query(`
    UPDATE cached_jobs SET verified_tasks = verified_tasks + $1, updated_at = $2 WHERE id = $3
  `, [Number(args.approvedTasks), now, Number(args.jobId)]);

  logger.info('indexed_work_verified', { submissionId: Number(args.submissionId), jobId: Number(args.jobId), payout: formatUnits(args.payout, 6), block: Number(blockNumber) });
}

async function handleJobCancelled(args: { jobId: bigint; refund: bigint }, blockNumber: bigint) {
  const now = new Date().toISOString();
  await query(`
    UPDATE cached_jobs SET status = 3, updated_at = $1 WHERE id = $2
  `, [now, Number(args.jobId)]);
  logger.info('indexed_job_cancelled', { jobId: Number(args.jobId), refund: formatUnits(args.refund, 6), block: Number(blockNumber) });
}

// Query helpers for the frontend
export async function getCachedJobs(filters?: { client?: string; status?: number }) {
  let q = 'SELECT * FROM cached_jobs';
  const params: any[] = [];
  const conditions: string[] = [];
  if (filters?.client) { params.push(filters.client.toLowerCase()); conditions.push(`client = $${params.length}`); }
  if (filters?.status !== undefined) { params.push(filters.status); conditions.push(`status = $${params.length}`); }
  if (conditions.length > 0) q += ' WHERE ' + conditions.join(' AND ');
  q += ' ORDER BY id DESC';
  return queryAll(q, params);
}

export async function getCachedSubmissions(filters?: { jobId?: number; worker?: string }) {
  let q = 'SELECT * FROM cached_submissions';
  const params: any[] = [];
  const conditions: string[] = [];
  if (filters?.jobId !== undefined) { params.push(filters.jobId); conditions.push(`job_id = $${params.length}`); }
  if (filters?.worker) { params.push(filters.worker.toLowerCase()); conditions.push(`worker = $${params.length}`); }
  if (conditions.length > 0) q += ' WHERE ' + conditions.join(' AND ');
  q += ' ORDER BY id DESC';
  return queryAll(q, params);
}

/**
 * Poll for new events from the last indexed block.
 * Call this on a timer (e.g. every 10 seconds) or on page load.
 */
export async function syncEvents() {
  await ensureCacheTables();
  const client = createPublicClient({ chain: arcTestnet, transport: http() });
  const fromBlock = await getLastBlock() + 1n;
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
      case 'JobCreated': await handleJobCreated(log.args as any, bn); break;
      case 'WorkSubmitted': await handleWorkSubmitted(log.args as any, bn); break;
      case 'WorkVerified': await handleWorkVerified(log.args as any, bn); break;
      case 'JobCancelled': await handleJobCancelled(log.args as any, bn); break;
    }
  }

  await setLastBlock(currentBlock);
  logger.info('sync_complete', { fromBlock: Number(fromBlock), toBlock: Number(currentBlock), events: logs.length });
  return { synced: true, fromBlock: Number(fromBlock), toBlock: Number(currentBlock), events: logs.length };
}
