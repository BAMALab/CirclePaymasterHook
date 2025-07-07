// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/CirclePaymaster.sol";
import "../src/Hook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

contract DeploySepolia is Script {
    // Sepolia Testnet Configuration
    address constant SEPOLIA_CIRCLE_PAYMASTER =
        0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966;
    address constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== DEPLOYING TO SEPOLIA TESTNET ===");
        console.log("Deployer:", deployer);
        console.log("Circle Paymaster:", SEPOLIA_CIRCLE_PAYMASTER);
        console.log("USDC:", SEPOLIA_USDC);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Circle Paymaster Integration
        CirclePaymasterIntegration circlePaymasterIntegration = new CirclePaymasterIntegration(
                SEPOLIA_CIRCLE_PAYMASTER,
                SEPOLIA_USDC
            );

        console.log(
            "Circle Paymaster Integration deployed at:",
            address(circlePaymasterIntegration)
        );

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Sepolia Testnet");
        console.log(
            "Circle Paymaster Integration:",
            address(circlePaymasterIntegration)
        );
        console.log("Circle Paymaster Address:", SEPOLIA_CIRCLE_PAYMASTER);
        console.log("USDC Address:", SEPOLIA_USDC);
        console.log("========================\n");
    }
}
