const { createWalletClient, createPublicClient, http, parseUnits, keccak256, stringToBytes } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const ARC_RPC = 'https://rpc.testnet.arc.network';
const arcTestnet = { id: 5042002, name: 'Arc Testnet', nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 }, rpcUrls: { default: { http: [ARC_RPC] } } };
const account = privateKeyToAccount('0x19f02090dd79e4ec67182e9cee3a71e9c225ee22613d6a56bff4b10c380ad2c0');
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
const ESCROW_ADDRESS = '0x277afbde7b6c8f5bf29107ee92592a5ff430cbd4';

const client = createWalletClient({ account, chain: arcTestnet, transport: http() });
const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

const USDC_ABI = [{ type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }];
const ESCROW_ABI = [
  { type: 'function', name: 'createJob', stateMutability: 'nonpayable', inputs: [{ name: 'totalTasks', type: 'uint64' }, { name: 'rewardPerTask', type: 'uint128' }, { name: 'deadline', type: 'uint64' }, { name: 'metadataURI', type: 'string' }, { name: 'isWhitelist', type: 'bool' }], outputs: [{ name: 'jobId', type: 'uint256' }] },
  { type: 'function', name: 'submitWork', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'submittedTasks', type: 'uint64' }, { name: 'proofHash', type: 'bytes32' }], outputs: [{ name: 'submissionId', type: 'uint256' }] },
  { type: 'function', name: 'verifyWork', stateMutability: 'nonpayable', inputs: [{ name: 'submissionId', type: 'uint256' }, { name: 'approvedTasks', type: 'uint64' }], outputs: [] },
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'nextJobId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'nextSubmissionId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }
];

async function run() {
  console.log('--- Starting End-to-End Contract Test ---');
  
  // Parameters
  const tasks = 1n;
  const reward = parseUnits('0.05', 6);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
  const metadata = JSON.stringify({ title: 'E2E Test', description: 'Testing the contract flow' });

  // 1. Approve USDC
  console.log('1. Approving USDC...');
  const approveTx = await client.writeContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'approve', args: [ESCROW_ADDRESS, tasks * reward] });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log('   Approve TX:', approveTx);

  // 2. Create Job
  console.log('2. Creating Job...');
  const nextJobIdBefore = await publicClient.readContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: 'nextJobId' });
  const createTx = await client.writeContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: 'createJob', args: [tasks, reward, deadline, metadata, false], gas: 1000000n });
  await publicClient.waitForTransactionReceipt({ hash: createTx });
  console.log('   Create Job TX:', createTx);
  const jobId = nextJobIdBefore;
  console.log('   Job ID assigned:', jobId.toString());

  // 3. Submit Work
  console.log('3. Submitting Work...');
  const nextSubmissionIdBefore = await publicClient.readContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: 'nextSubmissionId' });
  const proofHash = keccak256(stringToBytes('test-proof-' + Date.now()));
  const submitTx = await client.writeContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: 'submitWork', args: [jobId, tasks, proofHash], gas: 1000000n });
  await publicClient.waitForTransactionReceipt({ hash: submitTx });
  console.log('   Submit Work TX:', submitTx);
  const submissionId = nextSubmissionIdBefore;
  console.log('   Submission ID assigned:', submissionId.toString());

  // 4. Verify Work
  console.log('4. Verifying Work (Approving tasks)...');
  const verifyTx = await client.writeContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: 'verifyWork', args: [submissionId, tasks], gas: 1000000n });
  await publicClient.waitForTransactionReceipt({ hash: verifyTx });
  console.log('   Verify Work TX:', verifyTx);

  // 5. Claim Payment
  console.log('5. Claiming Payment...');
  const claimTx = await client.writeContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: 'claim', args: [jobId], gas: 1000000n });
  await publicClient.waitForTransactionReceipt({ hash: claimTx });
  console.log('   Claim TX:', claimTx);

  console.log('--- E2E Test Completed Successfully ---');
}

run().catch(console.error);
