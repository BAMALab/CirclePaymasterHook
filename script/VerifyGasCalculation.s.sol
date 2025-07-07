// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CirclePaymaster.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VerifyGasCalculation is Script {
    address payable constant CIRCLE_PAYMASTER_INTEGRATION =
        payable(0x06893BD7f0dd2747290115a4189df0c57d3B8658);
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant USER = 0x2830C21ecA4d3F7b5D4e7b7AB4ca0D8C04025bf8;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== GAS CALCULATION VERIFICATION ===");
        console.log("Deployer:", deployer);
        console.log("User:", USER);

        vm.startBroadcast(deployerPrivateKey);

        CirclePaymasterIntegration integration = CirclePaymasterIntegration(
            CIRCLE_PAYMASTER_INTEGRATION
        );
        IERC20 usdc = IERC20(USDC);

        // Check initial balances
        uint256 userUsdcBefore = usdc.balanceOf(USER);
        console.log("User USDC before:", userUsdcBefore);

        // Get gas estimate
        (uint256 ethCost, uint256 usdcCost) = integration.getGasEstimate(USER);
        console.log("\n=== GAS ESTIMATION BREAKDOWN ===");
        console.log("ETH cost (wei):", ethCost);
        console.log("ETH cost (ether):", ethCost / 1e18);
        console.log("USDC cost:", usdcCost);
        console.log("Current gas price:", tx.gasprice);
        console.log("Gas price (Gwei):", tx.gasprice / 1e9);

        // Check the conversion rate
        uint256 usdcToEthRate = integration.usdcToEthRate();
        console.log("\n=== CONVERSION RATE ===");
        console.log("USDC to ETH rate:", usdcToEthRate);
        console.log("This means 1 ETH =", usdcToEthRate, "USDC");

        // Manual calculation verification
        uint256 manualUsdcCost = (ethCost * usdcToEthRate) / 1e18;
        console.log("Manual USDC calculation:", manualUsdcCost);
        console.log(
            "Matches contract calculation:",
            manualUsdcCost == usdcCost
        );

        // The issue: gas cost is too small to convert to USDC
        console.log("\n=== THE ISSUE ===");
        console.log("ETH cost in wei:", ethCost);
        console.log("ETH cost in ether:", ethCost / 1e18);
        console.log("When multiplied by rate (3000) and divided by 1e18:");
        console.log("Result:", (ethCost * 3000) / 1e18);
        console.log("This rounds down to 0 because the gas cost is too small!");

        // Test with a larger gas limit to see USDC deduction
        console.log("\n=== TESTING WITH LARGER GAS LIMIT ===");
        uint256 largeGasLimit = 1000000; // 1 million gas

        // Simulate what would happen with larger gas cost
        uint256 largeEthCost = largeGasLimit * tx.gasprice;
        uint256 largeUsdcCost = (largeEthCost * usdcToEthRate) / 1e18;

        console.log("Large gas limit:", largeGasLimit);
        console.log("Large ETH cost (wei):", largeEthCost);
        console.log("Large ETH cost (ether):", largeEthCost / 1e18);
        console.log("Large USDC cost:", largeUsdcCost);

        // Process gas payment with current small limit
        console.log("\n=== PROCESSING GAS PAYMENT ===");
        uint256 gasLimit = 100000;
        console.log("Processing gas payment for limit:", gasLimit);

        uint256 balanceBefore = usdc.balanceOf(USER);
        integration.processGasPayment(USER, gasLimit);
        uint256 balanceAfter = usdc.balanceOf(USER);

        console.log("USDC before gas payment:", balanceBefore);
        console.log("USDC after gas payment:", balanceAfter);
        console.log("USDC spent:", balanceBefore - balanceAfter);
        console.log("Expected USDC cost:", usdcCost);

        // Check user gas deposit
        uint256 userGasDeposit = integration.getUserGasDeposit(USER);
        console.log("User gas deposit:", userGasDeposit);

        vm.stopBroadcast();

        console.log("\n=== CONCLUSION ===");
        console.log("The USDC cost is 0 because:");
        console.log("1. Gas cost is very small (~0.0001 ETH)");
        console.log("2. When converted to USDC with rate 3000, it rounds to 0");
        console.log("3. No USDC is actually transferred");
        console.log("4. This is why your balance didn't change");

        console.log("\n=== SOLUTION ===");
        console.log("To see actual USDC deduction, we need:");
        console.log("1. Higher gas prices, OR");
        console.log("2. Lower USDC/ETH rate, OR");
        console.log("3. Larger gas limits");
        console.log("4. Or use Circle Paymaster's actual pricing");
    }
}
