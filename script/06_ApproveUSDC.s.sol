// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract ApproveUSDCScript is Script {
    address constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION = 0x072defE27c6f4e3c1Db13cb97aD51bC4A8f5154E;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(deployerPrivateKey);

        console2.log("=== APPROVING USDC ===");
        console2.log("User:", user);
        console2.log("USDC:", SEPOLIA_USDC);
        console2.log("Integration:", SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION);
        console2.log("======================");

        IERC20 usdc = IERC20(SEPOLIA_USDC);
        uint256 currentAllowance = usdc.allowance(user, SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION);
        
        console2.log("Current allowance:", currentAllowance);

        vm.startBroadcast();
        
        // Approve USDC for the integration contract
        usdc.approve(SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION, type(uint256).max);
        
        vm.stopBroadcast();

        uint256 newAllowance = usdc.allowance(user, SEPOLIA_CIRCLE_PAYMASTER_INTEGRATION);
        console2.log("New allowance:", newAllowance);
        console2.log("USDC approved successfully!");
    }
} 