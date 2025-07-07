// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "forge-std/console.sol";

/**
 * @title CirclePaymasterHook
 * @dev Uniswap V4 Hook that integrates with Circle's Paymaster service
 * Allows users to pay gas fees in USDC instead of native tokens during swaps
 */
contract CirclePaymasterHook is BaseHook, Ownable {
    using SafeERC20 for IERC20;

    // Circle Paymaster Integration contract
    address public immutable circlePaymasterIntegration;

    // USDC token address
    address public immutable USDC;

    // Gas estimation constants
    uint256 public constant BASE_GAS_COST = 21000;
    uint256 public constant SWAP_GAS_OVERHEAD = 150000;

    // USDC to ETH price oracle (simplified - in production use Chainlink)
    uint256 public usdcToEthRate = 3000; // 1 ETH = 3000 USDC (example)

    // Events
    event GasPaymentProcessed(
        address indexed user,
        uint256 usdcAmount,
        uint256 gasUsed
    );

    event PaymasterDeposit(address indexed user, uint256 amount);

    // Gas payment context for each swap
    struct GasContext {
        address user;
        uint256 estimatedGasCost;
        uint256 usdcReserved;
        uint256 startGas;
    }

    mapping(bytes32 => GasContext) private gasContexts;

    constructor(
        IPoolManager _poolManager,
        address _circlePaymasterIntegration,
        address _usdc
    ) BaseHook(_poolManager) Ownable(msg.sender) {
        circlePaymasterIntegration = _circlePaymasterIntegration;
        USDC = _usdc;
    }

    function getHookPermissions()
        public
        pure
        override
        returns (Hooks.Permissions memory)
    {
        return
            Hooks.Permissions({
                beforeInitialize: false,
                afterInitialize: false,
                beforeAddLiquidity: false,
                afterAddLiquidity: false,
                beforeRemoveLiquidity: false,
                afterRemoveLiquidity: false,
                beforeSwap: true,
                afterSwap: true,
                beforeDonate: false,
                afterDonate: false,
                beforeSwapReturnDelta: false,
                afterSwapReturnDelta: false,
                afterAddLiquidityReturnDelta: false,
                afterRemoveLiquidityReturnDelta: false
            });
    }

    function _beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        // Decode hook data to check if user wants gasless transaction
        bool useGaslessMode = false;
        address actualUser = sender; // Default to sender

        if (hookData.length > 0) {
            // For gasless mode, we expect the hookData to contain the actual user address
            // Format: abi.encode(bool useGaslessMode, address actualUser)
            if (hookData.length >= 65) {
                // bool + address = 32 + 32 + 1 = 65 bytes
                (useGaslessMode, actualUser) = abi.decode(
                    hookData,
                    (bool, address)
                );
            } else {
                useGaslessMode = abi.decode(hookData, (bool));
            }
        }

        if (useGaslessMode) {
            _processGasPayment(actualUser, key);
        }

        return (
            BaseHook.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            0
        );
    }

    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) internal override returns (bytes4, int128) {
        // Decode hook data to check if user used gasless transaction
        bool useGaslessMode = false;
        address actualUser = sender; // Default to sender

        if (hookData.length > 0) {
            // For gasless mode, we expect the hookData to contain the actual user address
            if (hookData.length >= 65) {
                (useGaslessMode, actualUser) = abi.decode(
                    hookData,
                    (bool, address)
                );
            } else {
                useGaslessMode = abi.decode(hookData, (bool));
            }
        }

        if (useGaslessMode) {
            _finalizeGasPayment(actualUser, key);
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    function _processGasPayment(address user, PoolKey calldata key) private {
        uint256 estimatedGas = _estimateGasCost();
        uint256 usdcRequired = _convertEthToUsdc(estimatedGas);

        // Check user has enough USDC
        require(
            IERC20(USDC).balanceOf(user) >= usdcRequired,
            "Insufficient USDC for gas payment"
        );

        // Check user has approved the Circle Paymaster Integration to spend USDC
        require(
            IERC20(USDC).allowance(user, circlePaymasterIntegration) >=
                usdcRequired,
            "Insufficient USDC allowance for Circle Paymaster"
        );

        // Call the Circle Paymaster Integration to process gas payment
        (bool success, ) = circlePaymasterIntegration.call(
            abi.encodeWithSignature(
                "processGasPayment(address,uint256)",
                user,
                estimatedGas
            )
        );
        require(success, "Circle Paymaster gas payment failed");

        console.log(
            "USDC deposited to Circle Paymaster during swap:",
            usdcRequired
        );

        // Store gas context
        bytes32 contextKey = keccak256(
            abi.encodePacked(user, key.toId(), block.number)
        );
        gasContexts[contextKey] = GasContext({
            user: user,
            estimatedGasCost: estimatedGas,
            usdcReserved: usdcRequired,
            startGas: gasleft()
        });
    }

    function _finalizeGasPayment(address user, PoolKey calldata key) private {
        bytes32 contextKey = keccak256(
            abi.encodePacked(user, key.toId(), block.number)
        );
        GasContext storage context = gasContexts[contextKey];

        require(context.user == user, "Invalid gas context");

        uint256 actualGasUsed = context.startGas - gasleft() + BASE_GAS_COST;
        uint256 actualUsdcCost = _convertEthToUsdc(actualGasUsed * tx.gasprice);

        // Refund excess USDC if actual cost is less than reserved
        if (context.usdcReserved > actualUsdcCost) {
            uint256 refund = context.usdcReserved - actualUsdcCost;

            // Call Circle Paymaster Integration to withdraw excess deposit
            (bool success, ) = circlePaymasterIntegration.call(
                abi.encodeWithSignature(
                    "withdrawUserGasDeposit(address,uint256)",
                    user,
                    refund
                )
            );
            require(success, "Failed to refund excess USDC");
        }

        emit GasPaymentProcessed(user, actualUsdcCost, actualGasUsed);

        // Clean up context
        delete gasContexts[contextKey];
    }

    function _estimateGasCost() private view returns (uint256) {
        return (BASE_GAS_COST + SWAP_GAS_OVERHEAD) * tx.gasprice;
    }

    function _convertEthToUsdc(
        uint256 ethAmount
    ) private view returns (uint256) {
        return (ethAmount * usdcToEthRate) / 1e18;
    }

    // Admin functions
    function updateUsdcToEthRate(uint256 newRate) external onlyOwner {
        usdcToEthRate = newRate;
    }

    // View functions
    function getGasEstimate(
        address user
    ) external view returns (uint256 ethCost, uint256 usdcCost) {
        ethCost = _estimateGasCost();
        usdcCost = _convertEthToUsdc(ethCost);
    }

    function getUserCirclePaymasterDeposit(
        address user
    ) external view returns (uint256) {
        (bool success, bytes memory data) = circlePaymasterIntegration
            .staticcall(
                abi.encodeWithSignature("getUserGasDeposit(address)", user)
            );
        require(success, "Failed to get user deposit");
        return abi.decode(data, (uint256));
    }

    // Receive ETH for paymaster operations
    receive() external payable {}
}
