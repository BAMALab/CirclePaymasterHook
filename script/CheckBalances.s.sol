// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {console2} from "forge-std/console2.sol";
import {Script} from "forge-std/Script.sol";

contract CheckBalancesScript is Script {
    address constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    function run() external {
        uint256 accountPrivateKey = vm.envUint("PRIVATE_KEY2");
        address account = vm.addr(accountPrivateKey);

        console2.log("=== ACCOUNT BALANCE CHECK ===");
        console2.log("Account:", account);
        console2.log("=============================");

        // Check ETH balance
        uint256 ethBalance = account.balance;
        console2.log("ETH Balance:", ethBalance);

        // Check USDC balance
        IERC20 usdc = IERC20(SEPOLIA_USDC);
        uint256 usdcBalance = usdc.balanceOf(account);
        console2.log("USDC Balance:", usdcBalance);

        // Check if account has enough for gasless swap
        if (ethBalance > 0 && usdcBalance > 0) {
            console2.log("Account ready for gasless swap");
        } else {
            console2.log("Account needs ETH and USDC for gasless swap");
        }
    }
}
