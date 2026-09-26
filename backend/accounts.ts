import { randomBytes } from 'node:crypto';
import { AccountRecord, AccountRole, query, queryOne } from './db';

export type PublicAccount = {
  id: string;
  email: string;
  role: AccountRole;
  walletAddress: string;
  createdAt: string;
};

/** Generate a UUIDv7 (RFC 9562) — time-ordered, sortable by creation time. */
export function uuidv7(): string {
  const now = Date.now();
  const bytes = randomBytes(16);
  bytes[0] = (now / 2 ** 40) & 0xff;
  bytes[1] = (now / 2 ** 32) & 0xff;
  bytes[2] = (now / 2 ** 24) & 0xff;
  bytes[3] = (now / 2 ** 16) & 0xff;
  bytes[4] = (now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function publicAccount(row: AccountRecord): PublicAccount {
  return { id: row.id, email: row.email, role: row.role, walletAddress: row.wallet_address, createdAt: row.created_at };
}

export async function findAccountByPrivyId(privyUserId: string) {
  const row = await queryOne<AccountRecord>('SELECT * FROM accounts WHERE privy_user_id = $1', [privyUserId]);
  return row ? publicAccount(row) : null;
}

export async function createAccount(input: { privyUserId: string; email: string; walletAddress: string; role: AccountRole }) {
  const existing = await findAccountByPrivyId(input.privyUserId);
  if (existing) {
    if (existing.role !== input.role) throw Object.assign(new Error('Account role is already set.'), { status: 409 });
    return existing;
  }

  const now = new Date().toISOString();
  const row: AccountRecord = {
    id: uuidv7(),
    privy_user_id: input.privyUserId,
    email: input.email.toLowerCase(),
    role: input.role,
    wallet_address: input.walletAddress.toLowerCase(),
    created_at: now,
    updated_at: now,
  };
  await query(
    `INSERT INTO accounts (id, privy_user_id, email, role, wallet_address, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [row.id, row.privy_user_id, row.email, row.role, row.wallet_address, row.created_at, row.updated_at]
  );
  return publicAccount(row);
}
