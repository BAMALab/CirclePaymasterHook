// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/console2.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {BaseScript} from "./base/BaseScript.sol";

contract InitializePoolScript is BaseScript {
    using CurrencyLibrary for Currency;

    /////////////////////////////////////
    // --- Configure These ---
    /////////////////////////////////////
    uint24 lpFee = 3000; // 0.30%
    int24 tickSpacing = 60;
    /////////////////////////////////////

    function run() external {
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: lpFee,
            tickSpacing: tickSpacing,
            hooks: hookContract
        });

        // Initialize the pool with a starting price
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(0); // Start at tick 0 (price 1:1)

        console2.log("=== POOL INITIALIZATION ===");
        console2.log("Pool Key:");
        console2.log("  - Currency0:", address(Currency.unwrap(currency0)));
        console2.log("  - Currency1:", address(Currency.unwrap(currency1)));
        console2.log("  - Fee:", lpFee);
        console2.log("  - TickSpacing:", tickSpacing);
        console2.log("  - Hook:", address(hookContract));
        console2.log("Starting sqrtPriceX96:", sqrtPriceX96);
        console2.log("pool manager", address(poolManager));
        
        console2.log("===========================");

        vm.startBroadcast();


        // Initialize the pool
        poolManager.initialize(poolKey, sqrtPriceX96);

        vm.stopBroadcast();

        console2.log("Pool initialized successfully!");
    }
}
