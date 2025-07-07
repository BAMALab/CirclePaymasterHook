// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/CirclePaymaster.sol";
import "../src/Hook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

contract DeployCirclePaymaster is Script {
    // Circle Paymaster Addresses:
    // Sepolia Testnet: 0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966
    // Arbitrum Mainnet: 0x6C973eBe80dCD8660841D4356bf15c32460271C9
    // Arbitrum Testnet: 0x31BE08D380A21fc740883c0BC434FcFc88740b58
    // Base Mainnet: 0x6C973eBe80dCD8660841D4356bf15c32460271C9
    // Base Testnet: 0x31BE08D380A21fc740883c0BC434FcFc88740b58

    // USDC Addresses:
    // Sepolia Testnet: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
    // Base Mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    // Base Testnet: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying Circle Paymaster Integration to Sepolia...");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Circle Paymaster Integration
        CirclePaymasterIntegration circlePaymasterIntegration = new CirclePaymasterIntegration(
                0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966, // Sepolia Circle Paymaster
                0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 // Sepolia USDC
            );

        console.log(
            "Circle Paymaster Integration deployed at:",
            address(circlePaymasterIntegration)
        );

        // Deploy Hook (you'll need to deploy Uniswap V4 PoolManager first)
        // For now, we'll use a placeholder address - you'll need to deploy PoolManager separately
        address poolManager = 0x0000000000000000000000000000000000000000; // TODO: Deploy PoolManager

        if (poolManager != address(0)) {
            address hookAddress = address(
                uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG)
            );

            // Deploy hook using create2
            bytes memory hookCreationCode = abi.encodePacked(
                type(CirclePaymasterHook).creationCode,
                abi.encode(
                    IPoolManager(poolManager),
                    address(circlePaymasterIntegration),
                    0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 // Sepolia USDC
                )
            );

            // Deploy hook
            bytes32 salt = bytes32(uint256(1));
            address deployedHook;

            assembly {
                deployedHook := create2(
                    0,
                    add(hookCreationCode, 0x20),
                    mload(hookCreationCode),
                    salt
                )
            }

            if (deployedHook == address(0)) {
                revert("Hook deployment failed");
            }

            console.log("Circle Paymaster Hook deployed at:", deployedHook);

            // Authorize the hook to call the Circle Paymaster Integration
            circlePaymasterIntegration.setAuthorizedCaller(deployedHook, true);
            console.log("Hook authorized to call Circle Paymaster Integration");
        }

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Sepolia Testnet");
        console.log(
            "Circle Paymaster Integration:",
            address(circlePaymasterIntegration)
        );
        console.log(
            "Circle Paymaster Address:",
            0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966
        );
        console.log(
            "USDC Address:",
            0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
        );
        if (poolManager != address(0)) {
            console.log("Hook Address:");
        } else {
            console.log("Hook: Not deployed (PoolManager not available)");
        }
        console.log("========================\n");
    }
}
