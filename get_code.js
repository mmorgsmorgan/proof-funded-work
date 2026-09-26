const { createPublicClient, http } = require('viem');
const publicClient = createPublicClient({ chain: { id: 5042002 }, transport: http('https://rpc.testnet.arc.network') });
publicClient.getBytecode({ address: '0x277aFbdE7B6C8F5Bf29107EE92592a5Ff430Cbd4' }).then(console.log);
