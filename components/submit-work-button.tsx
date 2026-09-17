'use client';

import { useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom, keccak256, stringToBytes } from 'viem';
import { arcTestnet, ESCROW_ABI, ESCROW_ADDRESS } from '../lib/arc';

const HAS_PRIVY = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

export function SubmitWorkButton({ onStatus }: { onStatus: (message: string) => void }) {
  if (!HAS_PRIVY) return <button className="row-action" disabled>Configure</button>;
  return <PrivySubmitWorkButton onStatus={onStatus} />;
}

function PrivySubmitWorkButton({ onStatus }: { onStatus: (message: string) => void }) {
  const { wallets, ready } = useWallets();

  async function submit() {
    const wallet = wallets[0];
    if (!wallet) { onStatus('Continue with email and finish account setup first.'); return; }
    if (!ESCROW_ADDRESS) { onStatus('Deploy the escrow and configure NEXT_PUBLIC_ESCROW_ADDRESS first.'); return; }
    try {
      await wallet.switchChain(arcTestnet.id);
      const provider = await wallet.getEthereumProvider();
      const client = createWalletClient({ chain: arcTestnet, transport: custom(provider) });
      const hash = await client.writeContract({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'submitWork',
        args: [0n, 10n, keccak256(stringToBytes(`sample-${Date.now()}`))],
        account: wallet.address as `0x${string}`,
      });
      onStatus(`Work submitted · ${hash.slice(0, 10)}…`);
    } catch {
      onStatus('Work submission was cancelled or rejected.');
    }
  }

  return <button className="row-action" disabled={!ready} onClick={submit}>Start ↗</button>;
}
