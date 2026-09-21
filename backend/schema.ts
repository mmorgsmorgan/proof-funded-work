import { pgTable, text, integer, bigint, timestamp, uniqueIndex, index, boolean } from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ */
/*  Accounts                                                          */
/* ------------------------------------------------------------------ */

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  privyUserId: text('privy_user_id').notNull().unique(),
  email: text('email').notNull().unique(),
  role: text('role', { enum: ['worker', 'task_giver'] }).notNull(),
  walletAddress: text('wallet_address').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: index('accounts_email_idx').on(table.email),
  walletIdx: index('accounts_wallet_idx').on(table.walletAddress),
}));

/* ------------------------------------------------------------------ */
/*  Idempotency Keys                                                  */
/* ------------------------------------------------------------------ */

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  responseStatus: integer('response_status').notNull(),
  responseBody: text('response_body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/*  Cached Jobs (synced from on-chain events)                         */
/* ------------------------------------------------------------------ */

export const cachedJobs = pgTable('cached_jobs', {
  id: integer('id').primaryKey(),
  client: text('client').notNull(),
  rewardPerTask: text('reward_per_task').notNull(),
  totalTasks: integer('total_tasks').notNull(),
  verifiedTasks: integer('verified_tasks').notNull().default(0),
  deadline: bigint('deadline', { mode: 'number' }).notNull(),
  status: integer('status').notNull().default(1),
  metadataUri: text('metadata_uri').notNull().default(''),
  budget: text('budget').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clientIdx: index('cached_jobs_client_idx').on(table.client),
  statusIdx: index('cached_jobs_status_idx').on(table.status),
}));

/* ------------------------------------------------------------------ */
/*  Cached Submissions (synced from on-chain events)                  */
/* ------------------------------------------------------------------ */

export const cachedSubmissions = pgTable('cached_submissions', {
  id: integer('id').primaryKey(),
  jobId: integer('job_id').notNull().references(() => cachedJobs.id),
  worker: text('worker').notNull(),
  submittedTasks: integer('submitted_tasks').notNull(),
  approvedTasks: integer('approved_tasks').notNull().default(0),
  proofHash: text('proof_hash').notNull(),
  reviewed: boolean('reviewed').notNull().default(false),
  payout: text('payout').notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  jobIdx: index('cached_submissions_job_idx').on(table.jobId),
  workerIdx: index('cached_submissions_worker_idx').on(table.worker),
}));

/* ------------------------------------------------------------------ */
/*  Indexer State                                                     */
/* ------------------------------------------------------------------ */

export const indexerState = pgTable('indexer_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
