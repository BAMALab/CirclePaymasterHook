// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {console2} from "forge-std/console2.sol";

import {BaseScript} from "./base/BaseScript.sol";

contract DebugSwapScript is BaseScript {
    function run() external {
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: hookContract // This must match the pool
        });

        // Get deployer address
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("=== DEBUG SWAP SCRIPT ===");
        console2.log("Deployer:", deployer);
        console2.log("Token0:", address(token0));
        console2.log("Token1:", address(token1));
        console2.log("Hook:", address(hookContract));
        console2.log("PoolManager:", address(poolManager));
        console2.log("SwapRouter:", address(swapRouter));

        // Check balances
        uint256 token0Balance = token0.balanceOf(deployer);
        uint256 token1Balance = token1.balanceOf(deployer);

        console2.log("Token0 balance:", token0Balance);
        console2.log("Token1 balance:", token1Balance);

        // Check allowances
        uint256 token0Allowance = token0.allowance(
            deployer,
            address(swapRouter)
        );
        uint256 token1Allowance = token1.allowance(
            deployer,
            address(swapRouter)
        );

        console2.log("Token0 allowance:", token0Allowance);
        console2.log("Token1 allowance:", token1Allowance);

        // Use non-gasless mode by default (empty hookData)
        bytes memory hookData = "";

        vm.startBroadcast();

        // We'll approve both, just for testing.
        token1.approve(address(swapRouter), type(uint256).max);
        token0.approve(address(swapRouter), type(uint256).max);

        console2.log("Approvals completed");

        // Execute swap without gasless mode
        try
            swapRouter.swapExactTokensForTokens({
                amountIn: 1e18,
                amountOutMin: 0, // Very bad, but we want to allow for unlimited price impact
                zeroForOne: true,
                poolKey: poolKey,
                hookData: hookData,
                receiver: deployer, // Use deployer address instead of address(this)
                deadline: block.timestamp + 3600 // 1 hour from now
            })
        {
            console2.log("Swap completed successfully!");
        } catch Error(string memory reason) {
            console2.log("Swap failed with reason:", reason);
        } catch {
            console2.log("Swap failed with unknown error");
        }

        vm.stopBroadcast();
    }
}
