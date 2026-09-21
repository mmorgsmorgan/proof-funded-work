// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {FundedWorkEscrow} from "../src/FundedWorkEscrow.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {Test} from "forge-std/Test.sol";

contract FundedWorkEscrowTest is Test {
    MockUSDC usdc; FundedWorkEscrow escrow; address client = address(0xC1); address worker = address(0xB0B); bytes32 proof = keccak256("batch-001");
    function setUp() public { usdc = new MockUSDC(); escrow = new FundedWorkEscrow(address(usdc)); usdc.mint(client, 10_000e6); vm.prank(client); usdc.approve(address(escrow), type(uint256).max); }
    function testClientMustFundBeforeWork() public { vm.prank(client); uint256 jobId = escrow.createJob(10_000, 1e6, uint64(block.timestamp + 7 days), "ipfs://tasks"); assertEq(usdc.balanceOf(address(escrow)), 10_000e6); (, , , uint64 verified, , , ) = escrow.jobs(jobId); assertEq(verified, 0); }
    function testVerifiedWorkBecomesClaimable() public { vm.prank(client); uint256 jobId = escrow.createJob(10, 1e6, uint64(block.timestamp + 7 days), "ipfs://tasks"); vm.prank(worker); uint256 sid = escrow.submitWork(jobId, 4, proof); escrow.verifyWork(sid, 3); assertEq(escrow.claimable(worker), 3e6); assertEq(escrow.claimableByJob(worker, jobId), 3e6); assertEq(escrow.accuracyBps(worker), 7500); vm.prank(worker); escrow.claim(jobId); assertEq(usdc.balanceOf(worker), 3e6); }
    function testJobCompletesWhenAllTasksVerified() public { vm.prank(client); uint256 jobId = escrow.createJob(2, 5e6, uint64(block.timestamp + 7 days), "ipfs://tasks"); vm.prank(worker); uint256 sid = escrow.submitWork(jobId, 2, proof); escrow.verifyWork(sid, 2); (, , , uint64 verified, , FundedWorkEscrow.JobStatus status, ) = escrow.jobs(jobId); assertEq(verified, 2); assertEq(uint256(status), uint256(FundedWorkEscrow.JobStatus.Completed)); }
    function testWorkerGetsOneJobCreditAcrossMultipleSubmissions() public { vm.prank(client); uint256 jobId = escrow.createJob(4, 1e6, uint64(block.timestamp + 7 days), "ipfs://tasks"); vm.startPrank(worker); uint256 first = escrow.submitWork(jobId, 1, proof); uint256 second = escrow.submitWork(jobId, 1, keccak256("batch-002")); vm.stopPrank(); escrow.verifyWork(first, 1); escrow.verifyWork(second, 1); (, , , uint256 jobsCompleted) = escrow.reputation(worker); assertEq(jobsCompleted, 1); }
    function testExpiredJobRefundsUnverifiedRemainder() public { vm.prank(client); uint256 jobId = escrow.createJob(10, 1e6, uint64(block.timestamp + 1 days), "ipfs://tasks"); vm.prank(worker); uint256 sid = escrow.submitWork(jobId, 2, proof); escrow.verifyWork(sid, 1); vm.warp(block.timestamp + 2 days); uint256 before = usdc.balanceOf(client); vm.prank(client); escrow.cancelJob(jobId); assertEq(usdc.balanceOf(client) - before, 9e6); }

    function testSubmitWorkRejectsEmptyProof() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(10, 1e6, uint64(block.timestamp + 7 days), "ipfs://tasks");
        vm.prank(worker);
        vm.expectRevert("empty proof");
        escrow.submitWork(jobId, 4, bytes32(0));
    }

    function testPauseBlocksCreateJob() public {
        escrow.pause();
        vm.prank(client);
        vm.expectRevert("paused");
        escrow.createJob(10, 1e6, uint64(block.timestamp + 7 days), "ipfs://tasks");
    }

    function testJobScopedVerifierCanApprove() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(10, 1e6, uint64(block.timestamp + 7 days), "ipfs://tasks");
        
        address jobVerifier = address(0x123);
        vm.prank(client);
        escrow.setJobVerifier(jobId, jobVerifier, true);

        vm.prank(worker);
        uint256 sid = escrow.submitWork(jobId, 4, proof);

        vm.prank(jobVerifier);
        escrow.verifyWork(sid, 3);
        
        assertEq(escrow.claimable(worker), 3e6);
    }
}