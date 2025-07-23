// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {CirclePaymasterIntegration} from "../src/CirclePaymaster.sol";

contract AuthorizeHookScript is Script {
    address constant SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION =
        0x194CC08EFeD09BE41E94b9Bb4c5Aa265662B428e; // This matches the hook deployment
    address constant HOOK_CONTRACT = 0xc9e902b5047433935C8f6B173fC936Fd696C00c0;

    function run() external {
        console2.log("=== AUTHORIZING HOOK ===");
        console2.log(
            "Integration contract:",
            SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION
        );
        console2.log("Hook contract:", HOOK_CONTRACT);
        console2.log("=========================");

        vm.startBroadcast();

        // Authorize the hook to call the integration contract
        CirclePaymasterIntegration integration = CirclePaymasterIntegration(
            payable(SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION)
        );
        integration.setAuthorizedCaller(HOOK_CONTRACT, true);

        vm.stopBroadcast();

        console2.log("Hook authorized successfully!");
    }
}
