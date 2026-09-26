const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

// 1. Add SubmitProofModal component
const submitProofModal = `
function SubmitProofModal({ job, busy, onClose, onSubmit }: { job: Job; busy: boolean; onClose: () => void; onSubmit: (proofText: string) => void }) {
  const [proof, setProof] = React.useState('');
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="create-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <span className="label">JOB {job.id.toString().padStart(4, '0')}</span>
        <h2>Submit your work.</h2>
        <label>Proof of work
          <textarea value={proof} onChange={(e) => setProof(e.target.value)} placeholder="e.g., Link to your completed task, screenshots, or text description" rows={4} />
        </label>
        <div className="form-grid">
          <button className="primary-button full" disabled={busy || !proof} onClick={() => onSubmit(proof)}>{busy ? 'Submitting...' : 'Submit Proof ↗'}</button>
        </div>
        <p className="modal-note">Your proof will be securely hashed on-chain.</p>
      </div>
    </div>
  );
}
`;
if (!code.includes('function SubmitProofModal')) {
  code = code.replace('function ReviewModal', submitProofModal + '\nfunction ReviewModal');
}

// 2. Add SubmitProof state in main Page component
code = code.replace('const [reviewingSubmission, setReviewingSubmission] = useState<Submission | null>(null);', 'const [reviewingSubmission, setReviewingSubmission] = useState<Submission | null>(null);\n  const [submittingJob, setSubmittingJob] = useState<Job | null>(null);\n  const [whitelistingJob, setWhitelistingJob] = useState<Job | null>(null);');

// 3. Update submitWork to accept proofText
code = code.replace('async function submitWork(jobId: bigint) {', 'async function submitWork(jobId: bigint, proofText: string) {');
code = code.replace('writeContract(\'submitWork\', [jobId, 1n, keccak256(stringToBytes(`qit-proof-${jobId}-${Date.now()}`))])', 'writeContract(\'submitWork\', [jobId, 1n, keccak256(stringToBytes(proofText))])');
code = code.replace('setBusy(false); }', 'setBusy(false); setSubmittingJob(null); }');

// 4. Update WorkerView button and add Whitelist notice
code = code.replace('onSubmit: (jobId: bigint) => void;', 'onSubmit: (job: Job) => void;');
code = code.replace('onClick={() => onSubmit(job.id)}>Submit proof ↗</button>', 'onClick={() => onSubmit(job)}>{job.isWhitelist ? \'Submit (Whitelist Only) ↗\' : \'Submit proof ↗\'}</button>');

// 5. Update main component JSX to include SubmitProofModal and fix the callback
code = code.replace('onSubmit={submitWork}', 'onSubmit={setSubmittingJob}');
code = code.replace('{reviewingSubmission && <ReviewModal', '{submittingJob && <SubmitProofModal job={submittingJob} busy={busy} onClose={() => setSubmittingJob(null)} onSubmit={(proof) => submitWork(submittingJob.id, proof)} />}\n{reviewingSubmission && <ReviewModal');

// 6. Update TaskGiverView to add Whitelist Worker button
code = code.replace('onCancel: (jobId: bigint) => void;', 'onCancel: (jobId: bigint) => void; onWhitelist?: (job: Job) => void;');
code = code.replace('onClick={() => onCancel(job.id)}>Refund expired ↗</button>', 'onClick={() => onCancel(job.id)} title="You can only refund jobs after the deadline has passed.">Refund expired ↗</button>\n{job.isWhitelist && onWhitelist && <button className="table-action" disabled={busy} onClick={() => onWhitelist(job)}>Manage Whitelist</button>}');

// 7. Update main component TaskGiverView props
code = code.replace('onCancel={cancelJob} busy={busy}', 'onCancel={cancelJob} onWhitelist={setWhitelistingJob} busy={busy}');

// 8. Add WhitelistModal component and function
const whitelistModal = `
function WhitelistModal({ job, busy, onClose, onSubmit }: { job: Job; busy: boolean; onClose: () => void; onSubmit: (addresses: string[]) => void }) {
  const [addresses, setAddresses] = React.useState('');
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="create-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <span className="label">JOB {job.id.toString().padStart(4, '0')}</span>
        <h2>Whitelist Workers</h2>
        <label>Worker Addresses (comma separated)
          <textarea value={addresses} onChange={(e) => setAddresses(e.target.value)} placeholder="0x123..., 0x456..." rows={4} />
        </label>
        <div className="form-grid">
          <button className="primary-button full" disabled={busy || !addresses} onClick={() => onSubmit(addresses.split(',').map(a => a.trim()).filter(a => a.length > 0))}>{busy ? 'Processing...' : 'Whitelist ↗'}</button>
        </div>
      </div>
    </div>
  );
}
`;
if (!code.includes('function WhitelistModal')) {
  code = code.replace('function SubmitProofModal', whitelistModal + '\nfunction SubmitProofModal');
}

// 9. Add whitelist logic in main component
const whitelistLogic = `
  async function whitelistWorkers(jobId: bigint, workers: string[]) {
    if (workers.length === 0) return;
    setBusy(true); setMessage('Whitelisting workers in your wallet...');
    try { const hash = await writeContract('whitelistWorkers', [jobId, workers]); setMessage(\`Whitelisted · \${hash.slice(0, 10)}…\`); await refresh(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Whitelist was cancelled.'); }
    finally { setBusy(false); setWhitelistingJob(null); }
  }
`;
if (!code.includes('function whitelistWorkers')) {
  code = code.replace('async function submitWork', whitelistLogic + '\n  async function submitWork');
}
code = code.replace('{reviewingSubmission && <ReviewModal', '{whitelistingJob && <WhitelistModal job={whitelistingJob} busy={busy} onClose={() => setWhitelistingJob(null)} onSubmit={(workers) => whitelistWorkers(whitelistingJob.id, workers)} />}\n{reviewingSubmission && <ReviewModal');

// 10. Update ReviewModal button text to be clearer
code = code.replace('onClick={() => onSubmit(feedback, \'changes_requested\')}>Request Changes</button>', 'onClick={() => onSubmit(feedback, \'changes_requested\')} title="Type feedback to enable this button.">{!feedback ? \'Type feedback to Request Changes\' : \'Request Changes\'}</button>');


fs.writeFileSync('app/page.tsx', code);
console.log('Patched page.tsx!');
