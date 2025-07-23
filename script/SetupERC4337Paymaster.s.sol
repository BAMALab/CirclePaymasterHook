// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Paymaster} from "../src/Paymaster.sol";

contract SetupERC4337PaymasterScript is Script {
    // Deployed ERC-4337 Paymaster address
    address constant DEPLOYED_PAYMASTER =
        0x5b73C5498c1E3b4dbA84de0F1833c4a029d90519;
    // Circle Paymaster Integration address (your deployed hook)
    address constant CIRCLE_PAYMASTER_INTEGRATION =
        0x194CC08EFeD09BE41E94b9Bb4c5Aa265662B428e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast();

        console2.log("Setting up ERC-4337 Paymaster...");
        console2.log("Paymaster address:", DEPLOYED_PAYMASTER);
        console2.log("Deployer:", deployer);

        Paymaster paymaster = Paymaster(payable(DEPLOYED_PAYMASTER));

        // Add stake to the EntryPoint (required for paymaster to work)
        console2.log("Adding stake to EntryPoint...");
        paymaster.addStake{value: 0.1 ether}(86400); // 24 hour unstake delay

        // Authorize the Circle Paymaster Integration hook
        console2.log("Authorizing Circle Paymaster Integration hook...");
        paymaster.setAuthorizedHook(CIRCLE_PAYMASTER_INTEGRATION, true);

        vm.stopBroadcast();

        console2.log("ERC-4337 Paymaster setup completed!");
        console2.log("Paymaster address:", DEPLOYED_PAYMASTER);
        console2.log("EntryPoint deposit:", paymaster.getEntryPointDeposit());
        console2.log(
            "Hook authorized:",
            paymaster.isAuthorizedHook(CIRCLE_PAYMASTER_INTEGRATION)
        );
        console2.log("");
        console2.log("Your ERC-4337 Paymaster is now ready for gasless swaps!");
        console2.log(
            "Use working-gasless-swap.js for true zero-ETH gasless swaps"
        );
    }
}
