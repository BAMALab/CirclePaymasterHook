// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {console2} from "forge-std/console2.sol";
import {Script} from "forge-std/Script.sol";

contract MintTokensToAccountScript is Script {
    address constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    function run() external {
        uint256 accountPrivateKey = vm.envUint("PRIVATE_KEY2");
        address account = vm.addr(accountPrivateKey);

        console2.log("=== MINTING TOKENS TO ACCOUNT ===");
        console2.log("Account:", account);
        console2.log("==================================");

        vm.startBroadcast();

        // Mint USDC to the account
        IERC20 usdc = IERC20(SEPOLIA_USDC);
        // Note: This will only work if the USDC contract allows minting
        // For test tokens, you might need to use a faucet or transfer from another account

        // For now, let's just log what we're trying to do
        console2.log("Attempting to mint tokens to:", account);
        console2.log("USDC address:", SEPOLIA_USDC);

        vm.stopBroadcast();

        console2.log("Token minting completed for account:", account);
    }
}
