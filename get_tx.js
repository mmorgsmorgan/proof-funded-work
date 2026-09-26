const { createPublicClient, http } = require('viem');
const publicClient = createPublicClient({ chain: { id: 5042002, name: 'Arc Testnet', nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 }, rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } } }, transport: http() });

async function check() {
  try {
    const tx = await publicClient.getTransaction({ hash: '0xb3b9ffb326a3b3c22807612440ea86acc7091d5af401e6e9444ebb8ddd6cfa84' });
    console.log('Transaction:', tx);
    const receipt = await publicClient.getTransactionReceipt({ hash: '0xb3b9ffb326a3b3c22807612440ea86acc7091d5af401e6e9444ebb8ddd6cfa84' });
    console.log('Receipt:', receipt);
  } catch(e) { console.error(e); }
}
check();
