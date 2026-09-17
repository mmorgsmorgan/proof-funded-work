// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {FundedWorkEscrow} from "../src/FundedWorkEscrow.sol";
import {Script} from "forge-std/Script.sol";
contract Deploy is Script {
    address constant ARC_TESTNET_USDC = 0x3600000000000000000000000000000000000000;
    function run() external returns (FundedWorkEscrow escrow) { vm.startBroadcast(); escrow = new FundedWorkEscrow(ARC_TESTNET_USDC); vm.stopBroadcast(); }
}
