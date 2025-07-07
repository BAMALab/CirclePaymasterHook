// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Test} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {console} from "forge-std/console.sol";
import {TestERC20} from "v4-core/test/TestERC20.sol";
import {HookMiner} from "./utils/HookMinner.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";

import {CirclePaymasterHook} from "../src/Hook.sol";
import {CirclePaymasterIntegration} from "../src/CirclePaymaster.sol";

// Circle Paymaster Addresses:
// Arbitrum Mainnet: 0x6C973eBe80dCD8660841D4356bf15c32460271C9
// Arbitrum Testnet: 0x31BE08D380A21fc740883c0BC434FcFc88740b58
// Base Mainnet: 0x6C973eBe80dCD8660841D4356bf15c32460271C9
// Base Testnet: 0x31BE08D380A21fc740883c0BC434FcFc88740b58

contract TestCirclePaymasterHook is Test, Deployers {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    CirclePaymasterIntegration circlePaymasterIntegration;
    CirclePaymasterHook hook;
    MockERC20 usdc;

    // Circle Paymaster address (Base Testnet)
    address constant CIRCLE_PAYMASTER =
        0x31BE08D380A21fc740883c0BC434FcFc88740b58;

    PoolKey poolKey;
    PoolId poolId;

    address user = address(0x123);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address owner = makeAddr("owner");

    uint256 constant INITIAL_USDC_BALANCE = 10000000000000000e6; // 10,000 USDC
    uint256 constant INITIAL_ETH_BALANCE = 100 ether;
    uint256 constant USDC_TO_ETH_RATE = 3000; // 1 ETH = 3000 USDC

    function setUp() public {
        deployFreshManagerAndRouters();

        deployMintAndApprove2Currencies();

        usdc = new MockERC20("USDC", "USDC", 6);
        usdc.mint(user, 100000e6);
        usdc.mint(address(this), 1_000_000_000e6); // Mint 1 billion USDC to the test contract
        usdc.mint(alice, INITIAL_USDC_BALANCE);
        usdc.mint(bob, INITIAL_USDC_BALANCE);

        // Deploy Circle Paymaster Integration
        circlePaymasterIntegration = new CirclePaymasterIntegration(
            CIRCLE_PAYMASTER,
            address(usdc)
        );

        // Authorize the hook to call the Circle Paymaster Integration
        circlePaymasterIntegration.setAuthorizedCaller(address(this), true);

        address hookAddress = address(
            uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG)
        );

        vm.txGasPrice(10 gwei);

        deployCodeTo(
            "CirclePaymasterHook",
            abi.encode(
                manager,
                address(circlePaymasterIntegration),
                address(usdc)
            ),
            hookAddress
        );

        hook = CirclePaymasterHook(payable(hookAddress));

        // Authorize the hook to call the Circle Paymaster Integration
        circlePaymasterIntegration.setAuthorizedCaller(address(hook), true);

        // Replace ETH with another ERC20 for testing
        MockERC20 tokenB = new MockERC20("TokenB", "TKB", 18);
        tokenB.mint(address(this), 1_000_000 ether);
        tokenB.mint(alice, 1_000_000 ether);
        tokenB.mint(bob, 1_000_000 ether);

        currency0 = Currency.wrap(address(usdc)); // USDC
        currency1 = Currency.wrap(address(tokenB)); // TokenB

        // Approve tokenB for routers
        tokenB.approve(address(swapRouter), type(uint256).max);
        tokenB.approve(address(modifyLiquidityRouter), type(uint256).max);
        vm.prank(alice);
        tokenB.approve(address(hook), type(uint256).max);
        vm.prank(bob);
        tokenB.approve(address(hook), type(uint256).max);

        usdc.approve(address(swapRouter), type(uint256).max);
        usdc.approve(address(modifyLiquidityRouter), type(uint256).max);

        vm.prank(alice);
        usdc.approve(address(swapRouter), type(uint256).max);

        (key, ) = initPool(
            currency0,
            currency1,
            hook,
            LPFeeLibrary.DYNAMIC_FEE_FLAG,
            SQRT_PRICE_1_1
        );

        poolId = poolKey.toId();

        // Use a much wider tick range
        int24 tickLower = -60000;
        int24 tickUpper = 60000;
        uint160 sqrtPriceAtTickLower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtPriceAtTickUpper = TickMath.getSqrtPriceAtTick(tickUpper);

        uint128 liquidityDelta = 1e18; // much larger value for more liquidity

        uint256 usdcToAdd = LiquidityAmounts.getAmount0ForLiquidity(
            SQRT_PRICE_1_1,
            sqrtPriceAtTickUpper,
            liquidityDelta
        );

        uint256 tokenBToAdd = LiquidityAmounts.getAmount1ForLiquidity(
            sqrtPriceAtTickLower,
            SQRT_PRICE_1_1,
            liquidityDelta
        );

        usdc.mint(address(this), usdcToAdd);
        tokenB.mint(address(this), tokenBToAdd);

        modifyLiquidityRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: -60000,
                tickUpper: 60000,
                liquidityDelta: int256(uint256(liquidityDelta)),
                salt: bytes32(0)
            }),
            ZERO_BYTES
        );

        // Setup test accounts
        vm.deal(bob, INITIAL_ETH_BALANCE);

        console.log("currency0", address(Currency.unwrap(currency0)));
        console.log("currency1", address(Currency.unwrap(currency1)));
    }

    function testHookDeployment() public {
        assertEq(
            hook.circlePaymasterIntegration(),
            address(circlePaymasterIntegration)
        );
        assertEq(hook.USDC(), address(usdc));
        assertEq(hook.usdcToEthRate(), USDC_TO_ETH_RATE);
        assertTrue(circlePaymasterIntegration.authorizedCallers(address(hook)));
    }

    function testGasEstimate() public {
        (uint256 ethCost, uint256 usdcCost) = hook.getGasEstimate(user);
        assertTrue(ethCost > 0, "ETH cost should be greater than 0");
        assertTrue(usdcCost > 0, "USDC cost should be greater than 0");
    }

    function testHookPermissions() public {
        Hooks.Permissions memory permissions = hook.getHookPermissions();
        assertTrue(permissions.beforeSwap);
        assertTrue(permissions.afterSwap);
        assertFalse(permissions.beforeInitialize);
        assertFalse(permissions.afterInitialize);
    }

    function testSwapWithoutGaslessMode() public {
        uint256 poolIdUint = uint256(PoolId.unwrap(key.toId()));

        // Use empty hookData for non-gasless mode
        bytes memory hookData = "";

        uint256 aliceUsdcBefore = usdc.balanceOf(alice);

        // Swap USDC (currency0) for TokenB (currency1)
        // So, zeroForOne: true means USDC -> TokenB
        // Alice swaps USDC for TokenB
        vm.prank(alice);
        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: true, // USDC -> TokenB
                amountSpecified: -1_000_000, // 1 USDC (6 decimals)
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({
                takeClaims: false,
                settleUsingBurn: false
            }),
            hookData
        );

        // Should work normally without gas payment processing
        assertTrue(usdc.balanceOf(alice) < aliceUsdcBefore);
    }

    function testGaslessSwapPaysGasInUSDC() public {
        // Set up: Alice will swap TokenB for USDC, paying gas in USDC via Circle Paymaster
        uint256 poolIdUint = uint256(PoolId.unwrap(key.toId()));

        // Log the USDC address the hook expects
        address hookUsdc = hook.USDC();
        console.log("Hook expects USDC at:", hookUsdc);
        console.log("Test USDC address:", address(usdc));
        require(hookUsdc == address(usdc), "USDC address mismatch");

        // Ensure Alice has enough USDC and approval right before the swap
        usdc.mint(alice, 1_000_000_000e6); // Mint 1 billion USDC to Alice
        vm.prank(alice);
        usdc.approve(address(circlePaymasterIntegration), type(uint256).max);
        console.log("Alice USDC before swap:", usdc.balanceOf(alice));
        console.log(
            "Alice USDC allowance to Circle Paymaster Integration:",
            usdc.allowance(alice, address(circlePaymasterIntegration))
        );

        // Alice's balances before
        uint256 aliceEthBefore = alice.balance;
        uint256 aliceUsdcBefore = usdc.balanceOf(alice);
        uint256 integrationUsdcBefore = usdc.balanceOf(
            address(circlePaymasterIntegration)
        );

        console.log("--- BEFORE SWAP ---");
        console.log("Alice ETH:", aliceEthBefore);
        console.log("Alice USDC:", aliceUsdcBefore);
        console.log("Integration USDC:", integrationUsdcBefore);

        // Mint USDC to Alice for the swap
        usdc.mint(alice, 1_000_000_000e6); // 1 billion USDC to Alice
        vm.prank(alice);
        usdc.approve(address(swapRouter), type(uint256).max);

        // Mint USDC to the router for the gas payment
        usdc.mint(address(swapRouter), 1_000_000e6); // 1 million USDC
        vm.prank(address(swapRouter));
        usdc.approve(address(circlePaymasterIntegration), type(uint256).max);

        // Alice performs the gasless swap herself
        vm.startPrank(alice);
        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: true, // USDC -> TokenB
                amountSpecified: -1e6, // 1 USDC (6 decimals)
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({
                takeClaims: false,
                settleUsingBurn: false
            }),
            abi.encode(true, alice) // hookData: enable gasless mode and specify Alice as the user
        );
        vm.stopPrank();

        // Balances after
        uint256 aliceEthAfter = alice.balance;
        uint256 aliceUsdcAfter = usdc.balanceOf(alice);
        uint256 integrationUsdcAfter = usdc.balanceOf(
            address(circlePaymasterIntegration)
        );

        console.log("--- AFTER SWAP ---");
        console.log("Alice ETH:", aliceEthAfter);
        console.log("Alice USDC:", aliceUsdcAfter);
        console.log("Integration USDC:", integrationUsdcAfter);

        // Alice's ETH should be unchanged (gasless)
        assertTrue(
            aliceEthAfter >= aliceEthBefore,
            "Alice ETH should not decrease"
        );

        // Integration's USDC should increase (receives gas payment)
        assertTrue(
            integrationUsdcAfter > integrationUsdcBefore,
            "Integration USDC should increase"
        );

        console.log("Gas pay after", integrationUsdcAfter);
        console.log("Gas pay before", integrationUsdcBefore);

        // Log the actual USDC paid for gas
        uint256 usdcPaidForGas = integrationUsdcAfter - integrationUsdcBefore;
        console.log("USDC paid for gas:", usdcPaidForGas);

        // Amount Alice received from the swap (net of gas fee)
        uint256 usdcReceivedFromSwap = aliceUsdcAfter -
            aliceUsdcBefore +
            usdcPaidForGas;

        // Assert that the gas fee was deducted
        assertEq(
            aliceUsdcAfter,
            aliceUsdcBefore + usdcReceivedFromSwap - usdcPaidForGas,
            "Alice's USDC after swap should reflect gas fee deduction"
        );
        console.log("USDC received from swap:", usdcReceivedFromSwap);
        console.log("USDC paid for gas:", usdcPaidForGas);

        console.log("Alice net USDC change:", aliceUsdcAfter - aliceUsdcBefore);
        console.log(
            "Should equal swap received - gas paid:",
            usdcReceivedFromSwap - usdcPaidForGas
        );

        // Log the expected USDC gas cost
        (, uint256 expectedUsdcCost) = hook.getGasEstimate(alice);
        console.log("Expected USDC gas cost:", expectedUsdcCost);
    }

    function testRelayerGetsReimbursedInUSDC() public {
        address relayer = makeAddr("relayer");
        uint256 usdcGasFee = 10e6; // 10 USDC

        // Mint USDC to Alice and approve Circle Paymaster Integration
        usdc.mint(alice, usdcGasFee * 20);
        vm.prank(alice);
        usdc.approve(address(circlePaymasterIntegration), type(uint256).max);

        // Authorize the relayer
        circlePaymasterIntegration.setAuthorizedCaller(relayer, true);

        circlePaymasterIntegration.updateUsdcToEthRate(1e18); // 1 ETH = 1e18 USDC for test

        circlePaymasterIntegration.processGasPayment(alice, 10_000_000_000_000);

        uint256 relayerUsdcBefore = usdc.balanceOf(relayer);
        uint256 aliceUsdcBefore = usdc.balanceOf(alice);

        // Simulate relayer calling the Circle Paymaster Integration to get reimbursed in USDC
        vm.prank(relayer);
        circlePaymasterIntegration.reimburseRelayerInUSDC(
            alice,
            relayer,
            usdcGasFee
        );

        uint256 relayerUsdcAfter = usdc.balanceOf(relayer);
        uint256 aliceUsdcAfter = usdc.balanceOf(alice);

        assertEq(
            relayerUsdcAfter,
            relayerUsdcBefore + usdcGasFee,
            "Relayer should receive USDC"
        );
        assertEq(
            aliceUsdcAfter,
            aliceUsdcBefore,
            "Alice's USDC should remain the same (already deducted)"
        );
    }
}
