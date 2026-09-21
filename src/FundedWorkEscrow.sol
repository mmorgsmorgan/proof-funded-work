// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title Proof of Funded Work
/// @notice Clients lock the full USDC budget before workers can start. A verifier
///         attests to completed work; workers claim the corresponding USDC onchain.
contract FundedWorkEscrow {
    enum JobStatus { None, Open, Completed, Cancelled }
    struct Job { address client; uint128 rewardPerTask; uint64 totalTasks; uint64 verifiedTasks; uint64 deadline; JobStatus status; string metadataURI; }
    struct Submission { uint256 jobId; address worker; uint64 submittedTasks; uint64 approvedTasks; bytes32 proofHash; bool reviewed; }
    struct Reputation { uint256 submittedTasks; uint256 approvedTasks; uint256 totalEarned; uint256 jobsCompleted; }

    IERC20 public immutable usdc;
    address public owner;
    mapping(address => bool) public verifiers;
    mapping(uint256 => mapping(address => bool)) public jobVerifiers;
    uint256 public nextJobId;
    uint256 public nextSubmissionId;
    mapping(uint256 => Job) public jobs;
    mapping(uint256 => Submission) public submissions;
    mapping(address => uint256) public claimable;
    mapping(address => mapping(uint256 => uint256)) public claimableByJob;
    mapping(address => Reputation) public reputation;
    mapping(address => mapping(uint256 => bool)) public contributedToJob;
    uint256 private _lock = 1;
    bool public paused;

    event VerifierUpdated(address indexed verifier, bool enabled);
    event JobCreated(uint256 indexed jobId, address indexed client, uint256 totalTasks, uint256 rewardPerTask, uint256 budget);
    event WorkSubmitted(uint256 indexed submissionId, uint256 indexed jobId, address indexed worker, uint256 submittedTasks, bytes32 proofHash);
    event WorkVerified(uint256 indexed submissionId, uint256 indexed jobId, address indexed worker, uint256 approvedTasks, uint256 payout);
    event WorkClaimed(address indexed worker, uint256 indexed jobId, uint256 amount);
    event JobCancelled(uint256 indexed jobId, uint256 refund);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    modifier onlyVerifier() { require(verifiers[msg.sender], "not verifier"); _; }
    modifier nonReentrant() { require(_lock == 1, "reentrant"); _lock = 2; _; _lock = 1; }
    modifier onlyWhenNotPaused() { require(!paused, "paused"); _; }

    constructor(address usdc_) { require(usdc_ != address(0), "zero usdc"); usdc = IERC20(usdc_); owner = msg.sender; verifiers[msg.sender] = true; emit VerifierUpdated(msg.sender, true); }
    function setVerifier(address verifier, bool enabled) external onlyOwner { require(verifier != address(0), "zero verifier"); verifiers[verifier] = enabled; emit VerifierUpdated(verifier, enabled); }
    function pause() external onlyOwner { paused = true; emit Paused(msg.sender); }
    function unpause() external onlyOwner { paused = false; emit Unpaused(msg.sender); }
    function setJobVerifier(uint256 jobId, address verifier, bool enabled) external { require(jobs[jobId].client == msg.sender, "not client"); jobVerifiers[jobId][verifier] = enabled; }

    function createJob(uint64 totalTasks, uint128 rewardPerTask, uint64 deadline, string calldata metadataURI) external nonReentrant onlyWhenNotPaused returns (uint256 jobId) {
        require(totalTasks > 0 && rewardPerTask > 0, "invalid economics"); require(deadline > block.timestamp, "deadline passed");
        uint256 budget = uint256(totalTasks) * uint256(rewardPerTask); jobId = nextJobId++;
        jobs[jobId] = Job(msg.sender, rewardPerTask, totalTasks, 0, deadline, JobStatus.Open, metadataURI);
        require(usdc.transferFrom(msg.sender, address(this), budget), "funding failed"); emit JobCreated(jobId, msg.sender, totalTasks, rewardPerTask, budget);
    }

    function submitWork(uint256 jobId, uint64 submittedTasks, bytes32 proofHash) external onlyWhenNotPaused returns (uint256 submissionId) {
        require(proofHash != bytes32(0), "empty proof");
        Job storage job = jobs[jobId]; require(job.status == JobStatus.Open, "job not open"); require(block.timestamp <= job.deadline, "deadline passed");
        require(submittedTasks > 0 && uint256(job.verifiedTasks) + submittedTasks <= job.totalTasks, "invalid task count");
        submissionId = nextSubmissionId++; submissions[submissionId] = Submission(jobId, msg.sender, submittedTasks, 0, proofHash, false);
        reputation[msg.sender].submittedTasks += submittedTasks; emit WorkSubmitted(submissionId, jobId, msg.sender, submittedTasks, proofHash);
    }

    function verifyWork(uint256 submissionId, uint64 approvedTasks) external nonReentrant onlyWhenNotPaused {
        Submission storage submission = submissions[submissionId]; require(!submission.reviewed, "already reviewed");
        Job storage job = jobs[submission.jobId]; require(job.status == JobStatus.Open, "job not open"); require(approvedTasks <= submission.submittedTasks, "over approval");
        require(msg.sender == job.client || verifiers[msg.sender] || jobVerifiers[submission.jobId][msg.sender], "not job reviewer");
        require(uint256(job.verifiedTasks) + approvedTasks <= job.totalTasks, "job overfilled"); submission.reviewed = true; submission.approvedTasks = approvedTasks; job.verifiedTasks += approvedTasks;
        uint256 payout = uint256(approvedTasks) * uint256(job.rewardPerTask); claimable[submission.worker] += payout; claimableByJob[submission.worker][submission.jobId] += payout;
        Reputation storage rep = reputation[submission.worker]; rep.approvedTasks += approvedTasks; rep.totalEarned += payout;
        if (approvedTasks > 0 && !contributedToJob[submission.worker][submission.jobId]) { contributedToJob[submission.worker][submission.jobId] = true; rep.jobsCompleted += 1; }
        if (job.verifiedTasks == job.totalTasks) { job.status = JobStatus.Completed; }
        emit WorkVerified(submissionId, submission.jobId, submission.worker, approvedTasks, payout);
    }

    function claim(uint256 jobId) external nonReentrant onlyWhenNotPaused {
        require(jobs[jobId].status != JobStatus.None, "job not found"); uint256 amount = claimableByJob[msg.sender][jobId]; require(amount > 0, "nothing claimable");
        claimableByJob[msg.sender][jobId] = 0; claimable[msg.sender] -= amount; require(usdc.transfer(msg.sender, amount), "claim failed"); emit WorkClaimed(msg.sender, jobId, amount);
    }

    function cancelJob(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId]; require(job.client == msg.sender, "not client"); require(job.status == JobStatus.Open, "job not open"); require(block.timestamp > job.deadline, "deadline active");
        job.status = JobStatus.Cancelled; uint256 refund = uint256(job.totalTasks - job.verifiedTasks) * uint256(job.rewardPerTask);
        require(usdc.transfer(job.client, refund), "refund failed"); emit JobCancelled(jobId, refund);
    }

    function accuracyBps(address worker) external view returns (uint256) { Reputation memory rep = reputation[worker]; if (rep.submittedTasks == 0) return 0; return (rep.approvedTasks * 10_000) / rep.submittedTasks; }
}