'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

type Role = 'worker' | 'task_giver';
type Account = {
  id: string;
  email: string;
  role: Role;
  walletAddress: string;
};

const HAS_PRIVY = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

export function AccountMenu() {
  if (!HAS_PRIVY) {
    return <span className="account-config">Set Privy app ID</span>;
  }
  return <PrivyAccountMenu />;
}

function PrivyAccountMenu() {
  const { ready, authenticated, login, logout, getAccessToken } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [account, setAccount] = useState<Account | null>(null);
  const [choosingRole, setChoosingRole] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const loadAccount = useCallback(async () => {
    if (!authenticated) return;
    const token = await getAccessToken();
    if (!token) return;
    const response = await fetch('/api/account', { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 404) {
      setChoosingRole(true);
      return;
    }
    if (!response.ok) throw new Error('Could not load your Q\'IT account.');
    const body = await response.json();
    setAccount(body.account);
    setChoosingRole(false);
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    if (ready && authenticated && walletsReady) {
      loadAccount().catch((cause) => setError(cause instanceof Error ? cause.message : 'Account lookup failed.'));
    }
    if (ready && !authenticated) {
      setAccount(null);
      setChoosingRole(false);
    }
  }, [ready, authenticated, walletsReady, loadAccount]);

  async function createAccount(role: Role) {
    setBusy(true);
    setError('');
    try {
      if (!wallets[0]?.address) throw new Error('Your embedded wallet is still being created. Try again in a moment.');
      const token = await getAccessToken();
      if (!token) throw new Error('Your login session expired. Sign in again.');
      const response = await fetch('/api/account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Account creation failed.');
      setAccount(body.account);
      setChoosingRole(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account creation failed.');
    } finally {
      setBusy(false);
    }
  }

  const handleCopy = () => {
    if (!account) return;
    navigator.clipboard.writeText(account.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!ready) return <button className="account-button" disabled>Loading</button>;
  if (!authenticated) return <button className="account-button" onClick={login}>Continue with email</button>;

  if (choosingRole) {
    return (
      <div className="role-popover">
        <p>How will you use Q&apos;IT?</p>
        <div className="role-actions">
          <button disabled={busy || !walletsReady} onClick={() => createAccount('worker')}>Worker</button>
          <button disabled={busy || !walletsReady} onClick={() => createAccount('task_giver')}>Task giver</button>
        </div>
        {error && <span className="account-error">{error}</span>}
      </div>
    );
  }

  if (!account) return <button className="account-button" disabled>Creating wallet</button>;

  return (
    <div className="signed-in-account">
      <span className="account-role">{account.role === 'task_giver' ? 'Task giver' : 'Worker'}</span>
      <button className="account-copy" onClick={handleCopy} title="Copy full wallet address">
        {copied ? 'Copied ✓' : `${account.walletAddress.slice(0, 6)}…${account.walletAddress.slice(-4)}`}
      </button>
      <button className="account-logout" onClick={logout} title="Sign out">×</button>
    </div>
  );
}
