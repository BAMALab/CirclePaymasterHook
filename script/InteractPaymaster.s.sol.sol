// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CirclePaymaster.sol";
import "../src/Hook.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract InteractCirclePaymaster is Script {
    // Sepolia Testnet Configuration
    address payable constant CIRCLE_PAYMASTER_INTEGRATION =
        payable(0x06893BD7f0dd2747290115a4189df0c57d3B8658); // Deployed Circle Paymaster Integration
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238; // Sepolia USDC
    address constant USER = 0x2830C21ecA4d3F7b5D4e7b7AB4ca0D8C04025bf8; // Your deployer address
    address constant RELAYER = 0x31BE08D380A21fc740883c0BC434FcFc88740b58; // Example relayer

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== CIRCLE PAYMASTER INTERACTION ON SEPOLIA ===");
        console.log("Deployer:", deployer);
        console.log(
            "Integration Contract:",
            address(CIRCLE_PAYMASTER_INTEGRATION)
        );
        console.log("USDC Token:", USDC);
        console.log("User:", USER);
        console.log("Relayer:", RELAYER);

        vm.startBroadcast(deployerPrivateKey);

        CirclePaymasterIntegration integration = CirclePaymasterIntegration(
            CIRCLE_PAYMASTER_INTEGRATION
        );
        IERC20 usdc = IERC20(USDC);

        // Step 1: Check initial balances
        console.log("\n--- STEP 1: INITIAL BALANCES ---");
        uint256 userUsdcBefore = usdc.balanceOf(USER);
        uint256 integrationUsdcBefore = usdc.balanceOf(
            address(CIRCLE_PAYMASTER_INTEGRATION)
        );
        uint256 userGasDepositBefore = integration.getUserGasDeposit(USER);
        uint256 userUsdcAllowance = usdc.allowance(
            USER,
            address(CIRCLE_PAYMASTER_INTEGRATION)
        );

        console.log("User USDC Balance:", userUsdcBefore);
        console.log("Integration USDC Balance:", integrationUsdcBefore);
        console.log("User Gas Deposit:", userGasDepositBefore);
        console.log("User USDC Allowance:", userUsdcAllowance);

        // Step 2: Approve USDC spending (if not already approved)
        console.log("\n--- STEP 2: USDC APPROVAL ---");
        if (userUsdcAllowance < 1000000) {
            // Less than 1 USDC allowance
            console.log("Approving USDC spending...");
            usdc.approve(
                address(CIRCLE_PAYMASTER_INTEGRATION),
                type(uint256).max
            );
            console.log("USDC approval successful");
        } else {
            console.log("USDC already approved");
        }

        // Step 3: Get gas estimates
        console.log("\n--- STEP 3: GAS ESTIMATES ---");
        (uint256 ethCost, uint256 usdcCost) = integration.getGasEstimate(USER);
        console.log("Estimated ETH cost:", ethCost);
        console.log("Estimated USDC cost:", usdcCost);
        console.log("Current gas price:", tx.gasprice);

        // Step 4: Process gas payment
        console.log("\n--- STEP 4: PROCESS GAS PAYMENT ---");
        uint256 gasLimit = 100000;
        console.log("Processing gas payment for gas limit:", gasLimit);

        try integration.processGasPayment(USER, gasLimit) {
            console.log("Gas payment processed successfully!");
        } catch Error(string memory reason) {
            console.log("Gas payment failed:", reason);
        } catch (bytes memory) {
            console.log("Gas payment failed with low-level error");
        }

        // Step 5: Check balances after gas payment
        console.log("\n--- STEP 5: BALANCES AFTER GAS PAYMENT ---");
        uint256 userUsdcAfter = usdc.balanceOf(USER);
        uint256 integrationUsdcAfter = usdc.balanceOf(
            address(CIRCLE_PAYMASTER_INTEGRATION)
        );
        uint256 userGasDepositAfter = integration.getUserGasDeposit(USER);

        console.log("User USDC Balance:", userUsdcAfter);
        console.log("Integration USDC Balance:", integrationUsdcAfter);
        console.log("User Gas Deposit:", userGasDepositAfter);

        console.log("USDC spent on gas:", userUsdcBefore - userUsdcAfter);
        console.log(
            "USDC received by integration:",
            integrationUsdcAfter - integrationUsdcBefore
        );
        console.log(
            "Gas deposit change:",
            userGasDepositAfter - userGasDepositBefore
        );

        // Step 6: Test relayer reimbursement (if user has gas deposit)
        console.log("\n--- STEP 6: RELAYER REIMBURSEMENT ---");
        if (userGasDepositAfter > 0) {
            uint256 relayerUsdcBefore = usdc.balanceOf(RELAYER);
            uint256 reimbursementAmount = 1000000; // 1 USDC (6 decimals)

            if (userGasDepositAfter >= reimbursementAmount) {
                console.log("Reimbursing relayer with:", reimbursementAmount);
                try
                    integration.reimburseRelayerInUSDC(
                        USER,
                        RELAYER,
                        reimbursementAmount
                    )
                {
                    console.log("Relayer reimbursement successful!");
                    uint256 relayerUsdcAfter = usdc.balanceOf(RELAYER);
                    console.log("Relayer USDC before:", relayerUsdcBefore);
                    console.log("Relayer USDC after:", relayerUsdcAfter);
                    console.log(
                        "Relayer received:",
                        relayerUsdcAfter - relayerUsdcBefore
                    );
                } catch Error(string memory reason) {
                    console.log("Relayer reimbursement failed:", reason);
                } catch (bytes memory) {
                    console.log(
                        "Relayer reimbursement failed with low-level error"
                    );
                }
            } else {
                console.log("Insufficient gas deposit for reimbursement");
            }
        } else {
            console.log("No gas deposit available for reimbursement");
        }

        // Step 7: Test ETH deposit to Circle Paymaster
        console.log("\n--- STEP 7: ETH DEPOSIT TO CIRCLE PAYMASTER ---");
        uint256 ethDepositAmount = 0.001 ether;
        console.log("Depositing ETH to Circle Paymaster:", ethDepositAmount);

        try
            integration.depositToCirclePaymaster{value: ethDepositAmount}(
                USER,
                ethDepositAmount
            )
        {
            console.log("ETH deposit successful!");
        } catch Error(string memory reason) {
            console.log("ETH deposit failed:", reason);
        } catch (bytes memory) {
            console.log("ETH deposit failed with low-level error");
        }

        // Step 8: Final balance check
        console.log("\n--- STEP 8: FINAL BALANCES ---");
        uint256 userUsdcFinal = usdc.balanceOf(USER);
        uint256 integrationUsdcFinal = usdc.balanceOf(
            address(CIRCLE_PAYMASTER_INTEGRATION)
        );
        uint256 userGasDepositFinal = integration.getUserGasDeposit(USER);

        console.log("Final User USDC:", userUsdcFinal);
        console.log("Final Integration USDC:", integrationUsdcFinal);
        console.log("Final User Gas Deposit:", userGasDepositFinal);
        // console.log("Total USDC spent:", userUsdcBefore - userUsdcFinal);

        vm.stopBroadcast();

        console.log("\n=== INTERACTION COMPLETE ===");
        console.log("All Circle Paymaster functions tested on Sepolia!");
    }
}
