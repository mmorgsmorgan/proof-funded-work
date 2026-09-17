import { randomUUID } from 'node:crypto';
import { AccountRecord, AccountRole, getDatabase } from './db';

export type PublicAccount = {
  id: string;
  email: string;
  role: AccountRole;
  walletAddress: string;
  createdAt: string;
};

function publicAccount(row: AccountRecord): PublicAccount {
  return { id: row.id, email: row.email, role: row.role, walletAddress: row.wallet_address, createdAt: row.created_at };
}

export function findAccountByPrivyId(privyUserId: string) {
  const row = getDatabase().prepare('SELECT * FROM accounts WHERE privy_user_id = ?').get(privyUserId) as AccountRecord | undefined;
  return row ? publicAccount(row) : null;
}

export function createAccount(input: { privyUserId: string; email: string; walletAddress: string; role: AccountRole }) {
  const existing = findAccountByPrivyId(input.privyUserId);
  if (existing) {
    if (existing.role !== input.role) throw Object.assign(new Error('Account role is already set.'), { status: 409 });
    return existing;
  }

  const now = new Date().toISOString();
  const row: AccountRecord = {
    id: randomUUID(),
    privy_user_id: input.privyUserId,
    email: input.email.toLowerCase(),
    role: input.role,
    wallet_address: input.walletAddress.toLowerCase(),
    created_at: now,
    updated_at: now,
  };
  getDatabase().prepare(`
    INSERT INTO accounts (id, privy_user_id, email, role, wallet_address, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(row.id, row.privy_user_id, row.email, row.role, row.wallet_address, row.created_at, row.updated_at);
  return publicAccount(row);
}
