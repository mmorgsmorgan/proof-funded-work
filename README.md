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

After deployment, set `NEXT_PUBLIC_ESCROW_ADDRESS` in `.env.local`. The starter ABI is already included in `lib/arc.ts`; add any additional read methods you want to expose in the dashboard from `out/FundedWorkEscrow.sol/FundedWorkEscrow.json`.

## Frontend

```bash
npm install
npm run dev
```

Privy is configured for email-only login. Each new Privy user receives an embedded Ethereum wallet and then chooses one permanent Q'IT account role: `worker` or `task_giver`. The backend verifies the Privy token, verified email, and wallet before storing the account in SQLite through `/api/account`.

The initial dashboard is intentionally usable without a deployed address: it communicates the funded-work loop, Arc network context, representative open jobs, and wallet connection state. The next integration step is wiring `approve → createJob`, `submitWork`, `verifyWork`, and job-scoped `claim` calls against the deployed escrow.
