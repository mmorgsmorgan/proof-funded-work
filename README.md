# Q'IT

Q'IT is a stablecoin-native marketplace MVP for Arc testnet. Clients deposit the full USDC job budget into `FundedWorkEscrow` before workers can submit work. A verifier approves task counts, payouts become claimable, and worker reputation is recorded onchain.

## Arc testnet

- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- Test USDC: `0x3600000000000000000000000000000000000000` (6 decimals)
- FundedWorkEscrow: `0x2cDd9997A86AcD2260623Ca9825EC49681302632`
- Deployment tx: `0xc73eeba08c93c10b3eb611cfa48b88f845e2b02ac23406e21ebcfa729ddf7b61`

## Contracts

```bash
cd proof-funded-work
forge test
forge script script/Deploy.s.sol:Deploy --rpc-url arc_testnet --broadcast
```

After deployment, set `NEXT_PUBLIC_ESCROW_ADDRESS` in `.env.local`. The starter ABI is already included in `lib/arc.ts`.

### Contract features

| Feature | Description |
|---------|-------------|
| **Escrow** | Full USDC budget locked before workers start |
| **Proof validation** | `submitWork` requires non-zero `proofHash` |
| **Pause / Unpause** | Owner can pause all operations except `cancelJob` (refunds always work) |
| **Scoped verifiers** | Job clients can assign per-job verifiers via `setJobVerifier()` |
| **Global verifiers** | Owner can add global verifiers via `setVerifier()` |
| **Reputation** | On-chain accuracy tracking (submitted vs approved tasks) |
| **Cancellation** | Clients refund unverified remainder after deadline expires |

## Frontend

```bash
npm install
npm run dev
```

Privy is configured for email-only login. Each new Privy user receives an embedded Ethereum wallet and then chooses one permanent Q'IT account role: `worker` or `task_giver`. The backend verifies the Privy token, verified email, and wallet before storing the account in SQLite through `/api/account`.

## API

### `GET /api/health`
Returns service health and database connectivity status.

### `GET /api/account`
Returns the authenticated user's Q'IT account. Rate limited: 30 req/min.

### `POST /api/account`
Creates a new Q'IT account with a chosen role. Rate limited: 5 req/min.

Supports the `Idempotency-Key` header to safely retry requests without creating duplicate accounts.

## System design

The architecture applies principles from *System Design Interview* (Alex Xu):

- **Rate limiting** — In-memory sliding window limiter on all API routes with `Retry-After` headers (Ch. 4)
- **Idempotency** — Deduplication of POST requests via `Idempotency-Key` header and SQLite-backed key store (Ch. 26)
- **Structured logging** — JSON-line request/response logging with timing for observability (Ch. 20)
- **UUIDv7 IDs** — Time-sorted account identifiers for chronological ordering and cursor pagination (Ch. 7)
- **Input validation** — UNIQUE constraints on email/wallet, non-zero proof hashes on-chain (Ch. 3)
