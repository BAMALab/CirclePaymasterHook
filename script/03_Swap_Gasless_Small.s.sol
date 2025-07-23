// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {console2} from "forge-std/console2.sol";

import {BaseScript} from "./base/BaseScript.sol";

contract GaslessSwapSmallScript is BaseScript {
    // Sepolia addresses
    address constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION =
        0x194CC08EFeD09BE41E94b9Bb4c5Aa265662B428e;

    function run() external {
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: hookContract
        });

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(deployerPrivateKey);

        console2.log("=== GASLESS SWAP (SMALL AMOUNT) ===");
        console2.log("User:", user);
        console2.log("=====================================");

        vm.startBroadcast();

        // Set up USDC requirements for gasless mode
        IERC20 usdc = IERC20(SEPOLIA_USDC);

        // Approve USDC for the Circle Paymaster Integration
        usdc.approve(SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION, type(uint256).max);

        // Approve tokens for swap router
        token1.approve(address(swapRouter), type(uint256).max);
        token0.approve(address(swapRouter), type(uint256).max);

        // Use gasless mode with user address
        bytes memory hookData = abi.encode(true, user);

        // Execute gasless swap with much smaller amount
        swapRouter.swapExactTokensForTokens({
            amountIn: 1e6, // 1 token (6 decimals) instead of 1e18
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: hookData,
            receiver: user,
            deadline: block.timestamp + 3600
        });

        vm.stopBroadcast();

        console2.log("Small gasless swap completed for user:", user);
    }
}
