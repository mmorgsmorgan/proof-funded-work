'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createPublicClient, createWalletClient, custom, formatUnits, http, keccak256, parseUnits, stringToBytes } from 'viem';
import { AccountMenu } from '../components/account-menu';
import { arcTestnet, ESCROW_ABI, ESCROW_ADDRESS, USDC_ABI, USDC_ADDRESS } from '../lib/arc';

type Role = 'worker' | 'task_giver';
type Account = { id: string; email: string; role: Role; walletAddress: string; createdAt: string };
type Review = { id: string; submission_id: number; reviewer: string; feedback: string; status: 'changes_requested' | 'approved'; created_at: string };
type Job = { id: bigint; client: `0x${string}`; rewardPerTask: bigint; totalTasks: bigint; verifiedTasks: bigint; deadline: bigint; status: number; metadataURI: string; isWhitelist: boolean; };
type Submission = { id: bigint; jobId: bigint; worker: `0x${string}`; submittedTasks: bigint; approvedTasks: bigint; proofHash: `0x${string}`; reviewed: boolean };

const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
const steps = [
  ['01', 'Fund', 'The task giver locks the full job budget in USDC.'],
  ['02', 'Work', 'Workers join knowing the payment already exists.'],
  ['03', 'Verify', 'Completed units are checked against a published rubric.'],
  ['04', 'Claim', 'Approved USDC becomes available to the worker.'],
];

function shortAddress(address?: string) { return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'; }
function statusLabel(status: number) { return ['Unknown', 'Open', 'Completed', 'Cancelled'][status] || 'Unknown'; }
function jobTitle(uri: string) {
  try { return JSON.parse(uri).title || 'Verified task batch'; } catch { return uri || 'Verified task batch'; }
}
function jobDesc(uri: string) {
  try { return JSON.parse(uri).description || ''; } catch { return ''; }
}

export default function Home() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [account, setAccount] = useState<Account | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [error, setError] = useState('');

  const loadAccount = useCallback(async () => {
    if (!authenticated) return;
    setLoadingAccount(true); setError('');
    try {
      const token = await getAccessToken();
      if (!token) return;
      const response = await fetch('/api/account', { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 404) { setAccount(null); setOnboarding(true); return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load account.');
      setAccount(body.account); setOnboarding(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Account lookup failed.'); }
    finally { setLoadingAccount(false); }
  }, [authenticated, getAccessToken]);

  useEffect(() => { if (ready && authenticated && walletsReady) loadAccount(); }, [ready, authenticated, walletsReady, loadAccount]);

  async function createAccount(role: Role) {
    setLoadingAccount(true); setError('');
    try {
      if (!wallets[0]?.address) throw new Error('Your embedded wallet is still being created. Try again in a moment.');
      const token = await getAccessToken();
      const response = await fetch('/api/account', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Account creation failed.');
      setAccount(body.account); setOnboarding(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Account creation failed.'); }
    finally { setLoadingAccount(false); }
  }

  if (!ready || (authenticated && (loadingAccount || (!walletsReady && !account)))) return <LandingPage />;
  if (!authenticated) return <LandingPage />;
  if (onboarding || !account) return <Onboarding accountError={error} busy={loadingAccount} onChoose={createAccount} />;
  return <Workspace account={account} wallet={wallets[0]?.address as `0x${string}` | undefined} />;
}

function LandingPage() {
  const [message, setMessage] = useState('');
  return <div className="site-shell"><div className="grain" aria-hidden="true" /><a className="skip-link" href="#work">Skip to funded work</a>
    <header className="site-header container"><a className="site-name" href="#top" aria-label="Q'IT home">Q&apos;IT</a><nav className="site-nav" aria-label="Primary navigation"><a href="#work">Work</a><a href="#process">Process</a><a href="#record">Record</a></nav><div className="header-account" id="account-entry"><AccountMenu /></div></header>
    <main><section className="hero container" id="top"><h1 className="hero-headline" aria-label="Money first. Work after."><span className="hero-line"><span data-hero-line>Money first.</span></span><span className="hero-line"><span data-hero-line><em>Work after.</em></span></span></h1><div className="hero-foot"><p className="hero-intro" data-hero-meta>Q&apos;IT is a work market where every task begins with visible, locked funds.</p><div className="escrow-ledger" data-hero-meta><div className="ledger-head"><span>Escrow / funded work</span><span className="live-mark">Ready</span></div><div className="ledger-value"><strong>USDC</strong><span>funded before work</span></div><div className="ledger-track"><span style={{ width: '68%' }} /></div><div className="ledger-foot"><span>Fund</span><span>Verify</span><span>Claim</span></div></div></div></section>
      <section className="work container" id="work"><div className="section-head" data-reveal><span className="label">Open funded work</span><span className="section-count">Onchain jobs</span></div><div className="job-header"><span>Job</span><span>Work</span><span>Locked</span><span>Rate</span><span>Progress</span><span>Action</span></div><ol className="work-list"><li className="work-row" data-job-row data-reveal><div className="work-index">LIVE</div><div className="work-name"><span className="work-arrow">↗</span><div><h2>Funded batches</h2><p>Sign in to see available work</p></div></div><div className="work-cell"><strong>USDC</strong><span><i /> Escrowed</span></div><div className="work-cell"><strong>Onchain</strong><span>per verified task</span></div><div className="work-progress"><strong>100%</strong><span>visible funding</span><div><i style={{ width: '100%' }} /></div></div><a className="row-action row-link" href="#account-entry">Enter workspace ↗</a></li></ol>{message && <div className="status-message" role="status">{message}</div>}</section>
      <section className="manifesto container" id="process"><span className="label" data-reveal>Why Q&apos;IT exists</span><p className="manifesto-line" data-reveal>Workers should never have to ask whether the money exists. <em>It should be visible before the first minute of work.</em></p><div className="process-grid">{steps.map(([number, title, copy]) => <article className="process-step" key={number} data-reveal><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
      <section className="record container" id="record"><div className="record-copy" data-reveal><span className="label">Private work record</span><h2>Your history works for you, not against everyone else.</h2><p>Q&apos;IT keeps approved work, accuracy, and earnings tied to each account.</p></div><div className="record-metrics" data-reveal><dl><dt>USDC</dt><dd>Claimable in your wallet</dd></dl><dl><dt>100%</dt><dd>Funding visible onchain</dd></dl><dl><dt>0</dt><dd>Unfunded jobs</dd></dl><div className="record-note"><span>Next step</span><strong>Enter the market</strong></div></div></section></main><footer className="site-footer container"><span>Q&apos;IT / Proof before promises</span><span>Arc testnet / 5042002</span><span>2026</span></footer></div>;
}

function Onboarding({ busy, accountError, onChoose }: { busy: boolean; accountError: string; onChoose: (role: Role) => void }) {
  return (
    <div className="app-shell">
      <header className="app-topbar container">
        <a className="site-name" href="/">Q&apos;IT</a>
        <div className="workspace-account">
          <AccountMenu />
        </div>
      </header>
      <main className="workspace-main container">
        <div className="workspace-heading">
          <div>
            <span className="label">Welcome</span>
            <h1>Choose your role.</h1>
          </div>
        </div>
        <div className="role-popover" style={{ marginTop: '2rem' }}>
          <p>How will you use Q&apos;IT?</p>
          <div className="role-actions">
            <button className="primary-button" disabled={busy} onClick={() => onChoose('worker')}>Worker</button>
            <button className="primary-button" disabled={busy} onClick={() => onChoose('task_giver')}>Task giver</button>
          </div>
          {accountError && <span className="account-error">{accountError}</span>}
        </div>
      </main>
    </div>
  );
}

function Workspace({ account, wallet }: { account: Account; wallet?: `0x${string}` }) {
  const { logout, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = wallets[0];
  const [tab, setTab] = useState<'market' | 'activity' | 'settings'>('market');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [claimable, setClaimable] = useState<bigint>(0n);
  const [claimableJobs, setClaimableJobs] = useState<Record<string, bigint>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', tasks: '100', rate: '1', days: '14', isWhitelist: false });
  const [reviewingSubmission, setReviewingSubmission] = useState<Submission | null>(null);
  const [reviews, setReviews] = useState<Record<string, Review[]>>({});

  const refresh = useCallback(async () => {
    try {
      const jobCount = await publicClient.readContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: 'nextJobId' });
      const loadedJobs: Job[] = [];
      for (let index = 0n; index < jobCount; index++) {
        const value = await publicClient.readContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: 'jobs', args: [index] }) as readonly [string, bigint, bigint, bigint, bigint, number, string, boolean];
        loadedJobs.push({ id: index, client: value[0] as `0x${string}`, rewardPerTask: value[1], totalTasks: value[2], verifiedTasks: value[3], deadline: value[4], status: value[5], metadataURI: value[6], isWhitelist: value[7] });
      }
      setJobs(loadedJobs.reverse());
      const submissionCount = await publicClient.readContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: 'nextSubmissionId' });
      const loadedSubmissions: Submission[] = [];
      for (let index = 0n; index < submissionCount; index++) {
        const value = await publicClient.readContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: 'submissions', args: [index] }) as readonly [bigint, string, bigint, bigint, string, boolean];
        loadedSubmissions.push({ id: index, jobId: value[0], worker: value[1] as `0x${string}`, submittedTasks: value[2], approvedTasks: value[3], proofHash: value[4] as `0x${string}`, reviewed: value[5] });
      }
      setSubmissions(loadedSubmissions.reverse());
      if (wallet) {
        setClaimable(await publicClient.readContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: 'claimable', args: [wallet] }));
        const entries = await Promise.all(loadedJobs.map(async (job) => [job.id.toString(), await publicClient.readContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: 'claimableByJob', args: [wallet, job.id] })] as const));
        setClaimableJobs(Object.fromEntries(entries));
      }
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not read Arc testnet state.'); }
  }, [wallet]);

  useEffect(() => { refresh(); }, [refresh]);
  const mySubmissions = useMemo(() => submissions.filter((item) => item.worker.toLowerCase() === wallet?.toLowerCase()), [submissions, wallet]);
  const openJobs = jobs.filter((job) => job.status === 1);
  const myJobs = jobs.filter((job) => job.client.toLowerCase() === wallet?.toLowerCase());

  async function writeContract(functionName: 'submitWork' | 'claim' | 'verifyWork' | 'cancelJob' | 'createJob', args: readonly unknown[]) {
    if (!embeddedWallet || !wallet) throw new Error('Your embedded wallet is not ready yet.');
    await embeddedWallet.switchChain(arcTestnet.id);
    const provider = await embeddedWallet.getEthereumProvider();
    const client = createWalletClient({ account: wallet, chain: arcTestnet, transport: custom(provider) });
    return client.writeContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName, args: args as never });
  }

  async function submitWork(jobId: bigint) {
    setBusy(true); setMessage('Confirm your work proof in the wallet…');
    try { const hash = await writeContract('submitWork', [jobId, 1n, keccak256(stringToBytes(`qit-proof-${jobId}-${Date.now()}`))]); setMessage(`Proof submitted · ${hash.slice(0, 10)}…`); await refresh(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Work submission was cancelled.'); }
    finally { setBusy(false); }
  }

  async function claimJob(jobId: bigint) {
    setBusy(true); setMessage('Confirm your claim in the wallet…');
    try { const hash = await writeContract('claim', [jobId]); setMessage(`Claim sent · ${hash.slice(0, 10)}…`); await refresh(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Claim was cancelled.'); }
    finally { setBusy(false); }
  }

  async function createJob() {
    const totalTasks = BigInt(form.tasks || 0); const reward = parseUnits(form.rate || '0', 6); const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(form.days || 1) * 86400);
    if (!form.title || totalTasks <= 0n || reward <= 0n) { setMessage('Add a title, task count, and reward.'); return; }
    setBusy(true); setMessage('Approve USDC in your wallet...');
    try {
      if (!embeddedWallet || !wallet) throw new Error('Your embedded wallet is not ready yet.');
      await embeddedWallet.switchChain(arcTestnet.id); const provider = await embeddedWallet.getEthereumProvider(); const client = createWalletClient({ account: wallet, chain: arcTestnet, transport: custom(provider) });
      const approval = await client.writeContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'approve', args: [ESCROW_ADDRESS, totalTasks * reward] });
      setMessage(`Waiting for USDC approval (tx: ${approval.slice(0, 10)})...`);
      await publicClient.waitForTransactionReceipt({ hash: approval });
      setMessage('Confirm job creation in your wallet...');
      const metadata = JSON.stringify({ title: form.title, description: form.description });
      const hash = await client.writeContract({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: 'createJob', args: [totalTasks, reward, deadline, metadata, form.isWhitelist] });
      setShowCreate(false); setMessage(`Job funded · ${hash.slice(0, 10)}…`); await refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Job creation was cancelled.'); }
    finally { setBusy(false); }
  }

  
  async function submitReview(submission: Submission, feedback: string, status: 'changes_requested' | 'approved') {
    setBusy(true);
    try {
      if (status === 'approved') {
        setMessage('Confirm approval in the wallet…');
        const hash = await writeContract('verifyWork', [submission.id, submission.submittedTasks]);
        setMessage(`Work approved · ${hash.slice(0, 10)}…`);
      }
      
      const token = await getAccessToken();
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: Number(submission.id), feedback, status })
      });
      
      setReviewingSubmission(null);
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Review failed or was cancelled.');
    } finally {
      setBusy(false);
    }
  }

  async function fetchReviews(submissionIds: number[]) {
    const newReviews = { ...reviews };
    for (const id of submissionIds) {
      if (newReviews[id]) continue;
      try {
        const res = await fetch(`/api/reviews?submissionId=${id}`);
        if (res.ok) {
          const data = await res.json();
          newReviews[id] = data.reviews;
        }
      } catch {}
    }
    setReviews(newReviews);
  }

  useEffect(() => {
    if (submissions.length > 0) fetchReviews(submissions.map(s => Number(s.id)));
  }, [submissions]);


  async function cancelJob(jobId: bigint) {
    setBusy(true); setMessage('Confirm the expired-job refund in the wallet…');
    try { const hash = await writeContract('cancelJob', [jobId]); setMessage(`Refund sent · ${hash.slice(0, 10)}…`); await refresh(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Refund was cancelled or the deadline is still active.'); }
    finally { setBusy(false); }
  }

  return <div className="app-shell"><header className="app-topbar container"><a className="site-name" href="/">Q&apos;IT</a><nav className="workspace-nav"><button className={tab === 'market' ? 'active' : ''} onClick={() => setTab('market')}>Dashboard</button><button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>History</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Settings</button></nav><div className="workspace-account"><AccountMenu /></div></header><main className="workspace-main container">{tab === 'market' ? <>{account.role === 'task_giver' ? <TaskGiverView jobs={myJobs} submissions={submissions.filter((item) => myJobs.some((job) => job.id === item.jobId))} onCreate={() => setShowCreate(true)} onRefresh={refresh} onVerify={setReviewingSubmission} onCancel={cancelJob} busy={busy} message={message} /> : <WorkerView jobs={openJobs} claimable={claimable} submissions={mySubmissions} reviews={reviews} onRefresh={refresh} busy={busy} message={message} onSubmit={submitWork} onClaim={claimJob} />}</> : tab === 'activity' ? <ActivityView account={account} jobs={jobs} submissions={account.role === 'worker' ? mySubmissions : submissions.filter((item) => myJobs.some((job) => job.id === item.jobId))} claimable={claimable} /> : <SettingsView account={account} wallet={wallet} />}</main>{showCreate && <CreateJobModal form={form} setForm={setForm} busy={busy} message={message} onClose={() => setShowCreate(false)} onSubmit={createJob} />}
{reviewingSubmission && <ReviewModal submission={reviewingSubmission} busy={busy} onClose={() => setReviewingSubmission(null)} onSubmit={(feedback, status) => submitReview(reviewingSubmission, feedback, status)} />}</div>;
}

function WorkerView({ jobs, claimable, submissions, reviews, onRefresh, busy, message, onSubmit, onClaim }: { jobs: Job[]; claimable: bigint; submissions: Submission[]; reviews: Record<string, Review[]>; onRefresh: () => void; busy: boolean; message: string; onSubmit: (jobId: bigint) => void; onClaim: (jobId: bigint) => void }) {
  return <section className="workspace-section"><div className="section-head"><div><span className="label">Open funded work</span><h2>Work with money already locked.</h2></div><div className="claim-panel"><span>Claimable total</span><strong>${formatUnits(claimable, 6)}</strong><button disabled={busy || claimable === 0n} onClick={() => { const job = submissions.find((item) => item.reviewed && item.approvedTasks > 0n); if (job) onClaim(job.jobId); else onRefresh(); }}>{claimable > 0n ? 'Claim approved USDC ↗' : 'Refresh balance ↻'}</button></div></div><div className="workspace-table"><div className="workspace-table-head"><span>Job</span><span>Funded</span><span>Rate</span><span>Progress</span><span /></div>{jobs.length === 0 ? <EmptyState text="No open funded jobs yet. Task givers can publish the first batch." /> : jobs.map((job) => <article className="workspace-job" key={job.id}><div><small>JOB {job.id.toString().padStart(4, '0')}</small><h3>{jobTitle(job.metadataURI)}</h3><p className="job-desc">{jobDesc(job.metadataURI)}</p><p>Client {shortAddress(job.client)}</p></div><div><strong>${formatUnits(job.rewardPerTask * job.totalTasks, 6)}</strong><small>USDC escrowed</small></div><div><strong>${formatUnits(job.rewardPerTask, 6)}</strong><small>per task</small></div><div><strong>{job.verifiedTasks.toString()} / {job.totalTasks.toString()}</strong><div className="mini-track"><i style={{ width: `${Number((job.verifiedTasks * 100n) / job.totalTasks)}%` }} /></div></div><button className="table-action" disabled={busy} onClick={() => onSubmit(job.id)}>Submit proof ↗</button></article>)}</div><div className="workspace-subsection"><div className="section-head compact"><div><span className="label">Recent submissions</span><h2>Your proof trail.</h2></div><button className="quiet-button" onClick={onRefresh}>Refresh ↻</button></div>{submissions.length === 0 ? <EmptyState text="Your submitted work will appear here." /> : <div className="submission-list">{submissions.slice(0, 6).map((item) => <div className="submission-row" key={item.id}><span>#{item.id.toString()}</span><strong>Job {item.jobId.toString()}</strong><span>{item.submittedTasks.toString()} tasks</span><span className={item.reviewed ? 'reviewed' : 'pending'}>{item.reviewed ? `${item.approvedTasks.toString()} approved` : 'Awaiting review'}</span>{reviews[item.id.toString()]?.length > 0 && (  <div className="submission-feedback">    <strong>Feedback: </strong> {reviews[item.id.toString()][0].feedback}     <span className="feedback-status">({reviews[item.id.toString()][0].status === 'changes_requested' ? 'Changes requested' : 'Approved'})</span>  </div>)}</div>)}</div>}</div>{message && <p className="workspace-message">{message}</p>}</section>;
}

function TaskGiverView({ jobs, submissions, onCreate, onRefresh, onVerify, onCancel, busy, message }: { jobs: Job[]; submissions: Submission[]; onCreate: () => void; onRefresh: () => void; onVerify: (submission: Submission) => void; onCancel: (jobId: bigint) => void; busy: boolean; message: string }) {
  return <section className="workspace-section"><div className="section-head"><div><span className="label">Your funded work</span><h2>Turn a brief into a funded market.</h2></div><button className="primary-button" onClick={onCreate}>Create funded job +</button></div><div className="workspace-kpis"><div><span>Active jobs</span><strong>{jobs.filter((job) => job.status === 1).length}</strong></div><div><span>USDC locked</span><strong>${formatUnits(jobs.reduce((sum, job) => sum + (job.rewardPerTask * job.totalTasks), 0n), 6)}</strong></div><div><span>Proofs to review</span><strong>{submissions.filter((item) => !item.reviewed).length}</strong></div></div><div className="workspace-table"><div className="workspace-table-head"><span>Job</span><span>Budget</span><span>Verified</span><span>Status</span><span /></div>{jobs.length === 0 ? <EmptyState text="You have no jobs yet. Create one and lock the full budget before workers begin." /> : jobs.map((job) => <article className="workspace-job" key={job.id}><div><small>JOB {job.id.toString().padStart(4, '0')}</small><h3>{jobTitle(job.metadataURI)}</h3><p className="job-desc">{jobDesc(job.metadataURI)}</p><p>Deadline {new Date(Number(job.deadline) * 1000).toLocaleDateString()}</p></div><div><strong>${formatUnits(job.rewardPerTask * job.totalTasks, 6)}</strong><small>USDC locked</small></div><div><strong>{job.verifiedTasks.toString()} / {job.totalTasks.toString()}</strong><small>tasks verified</small></div><div><strong className={job.status === 1 ? 'status-open' : 'status-closed'}>{statusLabel(job.status)}</strong><small>onchain state</small></div><button className="table-action" disabled={busy || Number(job.deadline) * 1000 > Date.now()} onClick={() => onCancel(job.id)}>Refund expired ↗</button></article>)}</div><div className="workspace-subsection"><div className="section-head compact"><div><span className="label">Verification queue</span><h2>Approve completed work.</h2></div><button className="quiet-button" onClick={onRefresh}>Refresh ↻</button></div>{submissions.filter((item) => !item.reviewed).length === 0 ? <EmptyState text="No pending proofs. New worker submissions will land here." /> : <div className="submission-list">{submissions.filter((item) => !item.reviewed).map((item) => <div className="submission-row" key={item.id}><span>#{item.id.toString()}</span><strong>Job {item.jobId.toString()}</strong><span>{item.submittedTasks.toString()} tasks from {shortAddress(item.worker)}</span><button className="table-action small" disabled={busy} onClick={() => onVerify(item)}>Review</button></div>)}</div>}</div>{message && <p className="workspace-message">{message}</p>}</section>;
}

function ActivityView({ account, jobs, submissions, claimable }: { account: Account; jobs: Job[]; submissions: Submission[]; claimable: bigint }) {
  return <section className="workspace-section"><div className="section-head"><div><span className="label">Private record</span><h2>A clean history of contribution.</h2></div><div className="claim-panel"><span>{account.role === 'worker' ? 'Claimable now' : 'Jobs created'}</span><strong>{account.role === 'worker' ? `$${formatUnits(claimable, 6)}` : jobs.filter((job) => job.client.toLowerCase() === account.walletAddress.toLowerCase()).length}</strong></div></div><div className="activity-grid"><div><span>Wallet</span><strong>{shortAddress(account.walletAddress)}</strong></div><div><span>Email</span><strong>{account.email}</strong></div><div><span>Role</span><strong>{account.role === 'worker' ? 'Worker' : 'Task giver'}</strong></div><div><span>Proofs recorded</span><strong>{submissions.length}</strong></div></div><div className="record-callout"><span>Reputation stays private.</span><p>Approved work, accuracy, and earnings are tied to your wallet without a public ranking layer.</p></div></section>;
}

function EmptyState({ text }: { text: string }) { return <div className="empty-state"><span>—</span><p>{text}</p></div>; }

function CreateJobModal({ form, setForm, busy, message, onClose, onSubmit }: { form: any; setForm: any; busy: boolean; message: string; onClose: () => void; onSubmit: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="create-modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}><button className="modal-close" onClick={onClose} aria-label="Close">×</button><span className="label">New funded job</span><h2>Lock the budget<br /><em>before the brief.</em></h2><label>Job title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Receipt fields" /></label><label>Requirements / Description<textarea value={form.description} onChange={(event) => { event.target.style.height = 'auto'; event.target.style.height = event.target.scrollHeight + 'px'; setForm({ ...form, description: event.target.value }); }} placeholder="What are the exact requirements? What should applicants provide?" rows={3} style={{ overflow: 'hidden' }} /></label><div className="form-grid"><label>Tasks<input type="number" min="1" value={form.tasks} onChange={(event) => setForm({ ...form, tasks: event.target.value })} /></label><label>USDC / task<input type="number" min="0.000001" step="0.000001" value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} /></label></div><label>Deadline<input type="number" min="1" value={form.days} onChange={(event) => setForm({ ...form, days: event.target.value })} /></label><label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', cursor: 'pointer' }}><input type="checkbox" checked={form.isWhitelist} onChange={(e) => setForm({ ...form, isWhitelist: e.target.checked })} /><span>Require Applications (Whitelist mode)</span></label><div className="modal-total"><span>Total escrow required</span><strong>${(Number(form.tasks || 0) * Number(form.rate || 0)).toFixed(2)} USDC</strong></div>{message && <p className="workspace-message" style={{ color: 'var(--orange)', marginBottom: '16px' }}>{message}</p>}<button className="primary-button full" disabled={busy || !form.title} onClick={onSubmit}>{busy ? 'Processing...' : 'Approve USDC and create job ↗'}</button><p className="modal-note">Your wallet will approve USDC, then create the escrow in two transactions.</p></div></div>;
}

function SettingsView({ account, wallet }: { account: Account; wallet?: `0x${string}` }) {
  return <section className="workspace-section"><div className="section-head"><div><span className="label">Settings</span><h2>Manage your account.</h2></div></div><div className="activity-grid"><div><span>Wallet Address</span><strong>{wallet || 'Loading...'}</strong></div><div><span>Email</span><strong>{account.email}</strong></div><div><span>Role</span><strong>{account.role === 'worker' ? 'Worker' : 'Task giver'}</strong></div><div><span>Network</span><strong>Arc Testnet (5042002)</strong></div><div><span>Escrow Contract</span><strong>{ESCROW_ADDRESS}</strong></div><div><span>USDC Contract</span><strong>{USDC_ADDRESS}</strong></div></div></section>;
}

function ReviewModal({ submission, busy, onClose, onSubmit }: { submission: Submission; busy: boolean; onClose: () => void; onSubmit: (feedback: string, status: 'changes_requested' | 'approved') => void }) {
  const [feedback, setFeedback] = useState('');
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="create-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <span className="label">Submission #{submission.id.toString()}</span>
        <h2>Review and respond.</h2>
        <label>Feedback
          <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="e.g., Looks good! Or: Please fix the layout on page 2." rows={4} />
        </label>
        <div className="form-grid">
          <button className="account-button" disabled={busy || !feedback} onClick={() => onSubmit(feedback, 'changes_requested')}>Request Changes</button>
          <button className="primary-button" disabled={busy} onClick={() => onSubmit(feedback, 'approved')}>Approve Work ↗</button>
        </div>
        <p className="modal-note">Requesting changes sends feedback off-chain. Approving sends an on-chain transaction to release USDC.</p>
      </div>
    </div>
  );
}
