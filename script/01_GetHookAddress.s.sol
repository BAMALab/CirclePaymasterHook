// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Hooks} from "v4-core/libraries/Hooks.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";
import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {BaseScript} from "./base/BaseScript.sol";
import "../src/Hook.sol";

contract GetHookAddressScript is BaseScript {
    address constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION = 0x072defE27c6f4e3c1Db13cb97aD51bC4A8f5154E;

    function run() external {
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(
            poolManager,
            SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION,
            SEPOLIA_USDC
        );
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_FACTORY,
            flags,
            type(CirclePaymasterHook).creationCode,
            constructorArgs
        );

        console2.log("=== HOOK DEPLOYMENT INFO ===");
        console2.log("Expected hook address:", hookAddress);
        console2.log("Salt:", vm.toString(salt));
        console2.log("Constructor args:");
        console2.log("  - PoolManager:", address(poolManager));
        console2.log("  - Integration:", SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION);
        console2.log("  - USDC:", SEPOLIA_USDC);
        console2.log("=============================");
        
        // If you want to deploy it, uncomment these lines:
        // vm.startBroadcast();
        // CirclePaymasterHook circlePaymasterHook = new CirclePaymasterHook{salt: salt}(
        //     poolManager, 
        //     SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION, 
        //     SEPOLIA_USDC
        // );
        // vm.stopBroadcast();
        // console2.log("Deployed hook at:", address(circlePaymasterHook));
    }
} 