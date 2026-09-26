const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');

const ARC_RPC = 'https://rpc.testnet.arc.network';
const arcTestnet = { id: 5042002, name: 'Arc Testnet', nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 }, rpcUrls: { default: { http: [ARC_RPC] } } };
const account = privateKeyToAccount('0x19f02090dd79e4ec67182e9cee3a71e9c225ee22613d6a56bff4b10c380ad2c0');
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

const client = createWalletClient({ account, chain: arcTestnet, transport: http() });
const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

const artifact = JSON.parse(fs.readFileSync('./out/FundedWorkEscrow.sol/FundedWorkEscrow.json', 'utf8'));

async function deploy() {
  console.log('Deploying FundedWorkEscrow to Arc Testnet...');
  const hash = await client.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args: [USDC_ADDRESS],
  });
  console.log('Deploy Tx Hash:', hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Deployed Contract Address:', receipt.contractAddress);
}
deploy().catch(console.error);
