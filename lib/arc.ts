import { defineChain } from 'viem';

export const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC || 'https://rpc.testnet.arc.network';
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3600000000000000000000000000000000000000') as `0x${string}`;
export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS || '0xA182E51650812e067371b145F0D59f32E9a3BC66') as `0x${string}`;
export const arcTestnet = defineChain({ id: 5042002, name: 'Arc Testnet', nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 }, rpcUrls: { default: { http: [ARC_RPC] } }, blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } } });

export const USDC_ABI = [
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: 'balance', type: 'uint256' }] },
] as const;

export const ESCROW_ABI = [
  { type: 'function', name: 'nextJobId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'nextSubmissionId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'jobs', stateMutability: 'view', inputs: [{ name: '', type: 'uint256' }], outputs: [{ name: 'client', type: 'address' }, { name: 'rewardPerTask', type: 'uint128' }, { name: 'totalTasks', type: 'uint64' }, { name: 'verifiedTasks', type: 'uint64' }, { name: 'deadline', type: 'uint64' }, { name: 'status', type: 'uint8' }, { name: 'metadataURI', type: 'string' }] },
  { type: 'function', name: 'submissions', stateMutability: 'view', inputs: [{ name: '', type: 'uint256' }], outputs: [{ name: 'jobId', type: 'uint256' }, { name: 'worker', type: 'address' }, { name: 'submittedTasks', type: 'uint64' }, { name: 'approvedTasks', type: 'uint64' }, { name: 'proofHash', type: 'bytes32' }, { name: 'reviewed', type: 'bool' }] },
  { type: 'function', name: 'createJob', stateMutability: 'nonpayable', inputs: [{ name: 'totalTasks', type: 'uint64' }, { name: 'rewardPerTask', type: 'uint128' }, { name: 'deadline', type: 'uint64' }, { name: 'metadataURI', type: 'string' }], outputs: [{ name: 'jobId', type: 'uint256' }] },
  { type: 'function', name: 'submitWork', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'submittedTasks', type: 'uint64' }, { name: 'proofHash', type: 'bytes32' }], outputs: [{ name: 'submissionId', type: 'uint256' }] },
  { type: 'function', name: 'verifyWork', stateMutability: 'nonpayable', inputs: [{ name: 'submissionId', type: 'uint256' }, { name: 'approvedTasks', type: 'uint64' }], outputs: [] },
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'cancelJob', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'claimable', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'claimableByJob', stateMutability: 'view', inputs: [{ name: '', type: 'address' }, { name: '', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'accuracyBps', stateMutability: 'view', inputs: [{ name: 'worker', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'reputation', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: 'submittedTasks', type: 'uint256' }, { name: 'approvedTasks', type: 'uint256' }, { name: 'totalEarned', type: 'uint256' }, { name: 'jobsCompleted', type: 'uint256' }] },
] as const;
