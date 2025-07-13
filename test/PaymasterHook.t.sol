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
import {MockDataConsumerV3} from "./mocks/MockDataConsumerV3.sol";

contract TestCirclePaymasterHook is Test, Deployers {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    CirclePaymasterIntegration circlePaymasterIntegration;
    CirclePaymasterHook hook;
    MockERC20 usdc;
    MockDataConsumerV3 mockOracle;

    // Circle Paymaster address (Base Testnet)
    address constant CIRCLE_PAYMASTER = 0x31BE08D380A21fc740883c0BC434FcFc88740b58;

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
        usdc.mint(address(this), 1_000_000_000e6);
        usdc.mint(alice, INITIAL_USDC_BALANCE);
        usdc.mint(bob, INITIAL_USDC_BALANCE);

        // Deploy Circle Paymaster Integration with mocked oracle
        mockOracle = new MockDataConsumerV3();
        mockOracle.setPrice(3000 * 1e8); // Correct price: 3000 USD/ETH

        circlePaymasterIntegration = new CirclePaymasterIntegration(
            CIRCLE_PAYMASTER,
            address(usdc),
            address(mockOracle)
        );

        circlePaymasterIntegration.setAuthorizedCaller(address(this), true);

        address hookAddress = address(
            uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG)
        );

        vm.txGasPrice(20 gwei);

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
        circlePaymasterIntegration.setAuthorizedCaller(address(hook), true);

        MockERC20 tokenB = new MockERC20("TokenB", "TKB", 18);
        tokenB.mint(address(this), 1_000_000 ether);

        currency0 = Currency.wrap(address(usdc));
        currency1 = Currency.wrap(address(tokenB));

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
            hook, // Fixed from Hooker.sol
            LPFeeLibrary.DYNAMIC_FEE_FLAG,
            SQRT_PRICE_1_1
        );

        poolId = poolKey.toId();

        int24 tickLower = -60000;
        int24 tickUpper = 60000;
        uint160 sqrtPriceAtTickLower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtPriceAtTickUpper = TickMath.getSqrtPriceAtTick(tickUpper);

        uint128 liquidityDelta = 1e18;

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

        tokenB.mint(alice, tokenBToAdd);
        tokenB.mint(bob, 1_000_000 ether);
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
    // 1. Setup initial balances
    uint256 initialAliceUSDC = 100_000e6; // 100,000 USDC
    usdc.mint(alice, initialAliceUSDC);
    
    // 2. Approve hook to spend Alice's USDC (for gas payments)
    vm.prank(alice);
    usdc.approve(address(hook), type(uint256).max);
    
    // 3. Approve swapRouter to spend Alice's USDC (for the actual swap)
    vm.prank(alice);
    usdc.approve(address(swapRouter), type(uint256).max);

    // 4. Fund the integration contract with some USDC
    uint256 integrationInitialUSDC = 10_000e6;
    usdc.mint(address(circlePaymasterIntegration), integrationInitialUSDC);

    // 5. Estimate gas costs
    (uint256 ethCost, uint256 usdcCost) = hook.getGasEstimate(alice);
    console.log("Estimated gas cost:", usdcCost, "USDC");

    // Ensure Alice has enough USDC for both swap and gas
    assertGt(
        usdc.balanceOf(alice),
        usdcCost + 1e6, // Swap amount + gas
        "Alice needs enough USDC for swap + gas"
    );

    // 6. Perform the gasless swap
    vm.prank(alice);
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
        abi.encode(true, alice) // Enable gasless mode for Alice
    );

    // 7. Verify results
    console.log("Alice USDC after:", usdc.balanceOf(alice));
    console.log("Integration USDC after:", usdc.balanceOf(address(circlePaymasterIntegration)));

    // Alice should have less USDC (swap amount + gas)
    assertLt(
        usdc.balanceOf(alice),
        initialAliceUSDC,
        "Alice's USDC should decrease"
    );

    // Integration contract should have received gas payment
    assertGt(
        usdc.balanceOf(address(circlePaymasterIntegration)),
        integrationInitialUSDC,
        "Integration should receive gas payment"
    );

    // Alice's ETH balance should remain unchanged (gasless)
    assertEq(
        alice.balance,
        INITIAL_ETH_BALANCE,
        "Alice's ETH balance should not change"
    );
}

    function testRelayerGetsReimbursedInUSDC() public {
        address relayer = makeAddr("relayer");
        uint256 usdcGasFee = 10e6; // 10 USDC
        
        // Ensure integration has USDC
        usdc.mint(address(circlePaymasterIntegration), 1000e6);
        
        // Set up Alice with deposit
        usdc.mint(alice, 1000e6);
        vm.prank(alice);
        usdc.approve(address(circlePaymasterIntegration), type(uint256).max);
        
        // First process a gas payment to create deposit
        vm.prank(address(hook));
        circlePaymasterIntegration.processGasPayment(alice, 100000);
        
        uint256 relayerUsdcBefore = usdc.balanceOf(relayer);
        
        // Now reimburse (using authorized caller)
        vm.prank(address(hook));
        circlePaymasterIntegration.reimburseRelayerInUSDC(
            alice,
            relayer,
            usdcGasFee
        );
        
        uint256 relayerUsdcAfter = usdc.balanceOf(relayer);
        assertEq(relayerUsdcAfter, relayerUsdcBefore + usdcGasFee);
    }
}