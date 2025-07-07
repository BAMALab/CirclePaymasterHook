// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CirclePaymaster.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestGasPayment is Script {
    // Sepolia Testnet Configuration
    address payable constant CIRCLE_PAYMASTER_INTEGRATION =
        payable(0x06893BD7f0dd2747290115a4189df0c57d3B8658);
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant USER = 0x2830C21ecA4d3F7b5D4e7b7AB4ca0D8C04025bf8;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== TESTING GAS PAYMENT FUNCTIONALITY ===");
        console.log("Deployer:", deployer);
        console.log(
            "Integration Contract:",
            address(CIRCLE_PAYMASTER_INTEGRATION)
        );

        vm.startBroadcast(deployerPrivateKey);

        CirclePaymasterIntegration integration = CirclePaymasterIntegration(
            CIRCLE_PAYMASTER_INTEGRATION
        );
        IERC20 usdc = IERC20(USDC);

        // Check initial state
        uint256 userUsdcBefore = usdc.balanceOf(USER);
        uint256 userAllowance = usdc.allowance(
            USER,
            address(CIRCLE_PAYMASTER_INTEGRATION)
        );

        console.log("User USDC Balance:", userUsdcBefore);
        console.log("User USDC Allowance:", userAllowance);

        // Approve USDC if needed
        if (userAllowance < 1000000) {
            usdc.approve(
                address(CIRCLE_PAYMASTER_INTEGRATION),
                type(uint256).max
            );
            console.log("USDC approved for integration contract");
        }

        // Test gas payment with different gas limits
        uint256[] memory gasLimits = new uint256[](3);
        gasLimits[0] = 50000; // 50k gas
        gasLimits[1] = 100000; // 100k gas
        gasLimits[2] = 200000; // 200k gas

        for (uint i = 0; i < gasLimits.length; i++) {
            console.log(
                "\n--- Testing Gas Payment for",
                gasLimits[i],
                "gas ---"
            );

            uint256 balanceBefore = usdc.balanceOf(USER);

            try integration.processGasPayment(USER, gasLimits[i]) {
                uint256 balanceAfter = usdc.balanceOf(USER);
                uint256 usdcSpent = balanceBefore - balanceAfter;
                console.log("Gas payment successful!");
                console.log("USDC spent:", usdcSpent);
                console.log("Gas limit:", gasLimits[i]);
            } catch Error(string memory reason) {
                console.log("Gas payment failed:", reason);
            } catch (bytes memory) {
                console.log("Gas payment failed with low-level error");
            }
        }

        // Final balance check
        uint256 finalBalance = usdc.balanceOf(USER);
        console.log("\n--- FINAL RESULTS ---");
        console.log("Initial USDC:", userUsdcBefore);
        console.log("Final USDC:", finalBalance);
        console.log("Total USDC spent:", userUsdcBefore - finalBalance);

        vm.stopBroadcast();

        console.log("\n=== GAS PAYMENT TESTING COMPLETE ===");
    }
}
