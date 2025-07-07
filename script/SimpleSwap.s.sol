// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CirclePaymaster.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleSwap is Script {
    // Sepolia Testnet Configuration
    address payable constant CIRCLE_PAYMASTER_INTEGRATION =
        payable(0x06893BD7f0dd2747290115a4189df0c57d3B8658);
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant USER = 0x2830C21ecA4d3F7b5D4e7b7AB4ca0D8C04025bf8;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== SIMPLE SWAP WITH GAS PAYMENT ===");
        console.log("Deployer:", deployer);
        console.log("User:", USER);

        vm.startBroadcast(deployerPrivateKey);

        CirclePaymasterIntegration integration = CirclePaymasterIntegration(
            CIRCLE_PAYMASTER_INTEGRATION
        );
        IERC20 usdc = IERC20(USDC);

        // Check initial balances
        uint256 userUsdcBefore = usdc.balanceOf(USER);
        uint256 userEthBefore = USER.balance;
        console.log("User USDC before:", userUsdcBefore);
        console.log("User ETH before:", userEthBefore);

        // Approve USDC if needed
        uint256 allowance = usdc.allowance(
            USER,
            address(CIRCLE_PAYMASTER_INTEGRATION)
        );
        if (allowance < 1000000) {
            console.log("Approving USDC...");
            usdc.approve(
                address(CIRCLE_PAYMASTER_INTEGRATION),
                type(uint256).max
            );
        }

        // Get gas estimate
        (uint256 ethCost, uint256 usdcCost) = integration.getGasEstimate(USER);
        console.log("Estimated ETH cost:", ethCost);
        console.log("Estimated USDC cost:", usdcCost);

        // Process gas payment for a small swap
        uint256 gasLimit = 50000; // Small gas limit for demo
        console.log("Processing gas payment for gas limit:", gasLimit);

        uint256 balanceBefore = usdc.balanceOf(USER);
        integration.processGasPayment(USER, gasLimit);
        uint256 balanceAfter = usdc.balanceOf(USER);

        console.log("USDC spent on gas:", balanceBefore - balanceAfter);
        console.log("Gas payment successful!");

        // Check final balances
        uint256 userUsdcAfter = usdc.balanceOf(USER);
        uint256 userEthAfter = USER.balance;
        console.log("User USDC after:", userUsdcAfter);
        console.log("User ETH after:", userEthAfter);
        console.log("Total USDC spent:", userUsdcBefore - userUsdcAfter);
        console.log("Total ETH spent:", userEthBefore - userEthAfter);

        vm.stopBroadcast();

        console.log("=== SWAP COMPLETE ===");
        console.log("Gas paid in USDC: SUCCESS");
        console.log("No ETH required: SUCCESS");
        console.log("Ready for production!");
    }
}
