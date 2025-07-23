// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ERC4337Integration} from "../src/ERC4337Integration.sol";

contract DeployERC4337IntegrationScript is Script {
    address constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant CIRCLE_PAYMASTER =
        0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966;

    function run() external {
        console2.log("=== DEPLOYING ERC-4337 INTEGRATION ===");
        console2.log("USDC Address:", SEPOLIA_USDC);
        console2.log("Circle Paymaster:", CIRCLE_PAYMASTER);
        console2.log("======================================");

        vm.startBroadcast();

        ERC4337Integration integration = new ERC4337Integration(SEPOLIA_USDC);

        vm.stopBroadcast();

        console2.log("ERC-4337 Integration deployed at:", address(integration));
        console2.log("Deployment successful!");
    }
}
