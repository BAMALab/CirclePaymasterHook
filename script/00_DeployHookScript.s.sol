// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Hooks} from "v4-core/libraries/Hooks.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

import {BaseScript} from "./base/BaseScript.sol";
import "../src/Hook.sol";
// 0x68d99e5b7e75863ff68843bece98da4b8be440c0
// Sepoli paymaster 0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966

/// @notice Mines the address and deploys the Counter.sol Hook contract
contract DeployHookScript is BaseScript {

    address constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION = 0x194CC08EFeD09BE41E94b9Bb4c5Aa265662B428e; // formal address 0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966;
    function run() public {
        // hook contracts must have specific flags encoded in the address
        // uint160 flags = uint160(
        //     Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
        //         | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
        // );


        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(poolManager, SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION, SEPOLIA_USDC);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(CirclePaymasterHook).creationCode, constructorArgs);

        // Deploy the hook using CREATE2
        vm.startBroadcast();
        CirclePaymasterHook circlePaymasterHook = new CirclePaymasterHook{salt: salt}(poolManager, SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION, SEPOLIA_USDC);
        vm.stopBroadcast();
        console.log("Hook address:", address(circlePaymasterHook));

        require(address(circlePaymasterHook) == hookAddress, "DeployHookScript: Hook Address Mismatch");
    }
}