// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Script} from "forge-std/Script.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

contract SwapScriptFixed is Script {
    // Token addresses
    IERC20 constant token0 = IERC20(0x3B4c3885E8144af60A101c75468727863cFf23fA);
    IERC20 constant token1 = IERC20(0x90954dcFB08C84e1ebA306f59FAD660b3A7B5808);

    // Contract addresses
    address constant swapRouter = 0x00000000000044a361Ae3cAc094c9D1b14Eece97;
    address constant hookContract = 0x30c69a61deA101876F572450dE4eF7c1eEE240c0;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 5000, // 0.50% - must match the pool
            tickSpacing: 100, // must match the pool
            hooks: IHooks(hookContract) // This must match the pool
        });

        bytes memory hookData = abi.encode(true, deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Approve SwapRouter to spend tokens
        token0.approve(swapRouter, type(uint256).max);
        token1.approve(swapRouter, type(uint256).max);

        // Execute swap using the SwapRouter interface
        (bool success, ) = swapRouter.call(
            abi.encodeWithSignature(
                "swapExactTokensForTokens(uint256,uint256,bool,tuple,bytes,address,uint256)",
                1e18,
                0, // amountOutMin
                true, // zeroForOne
                poolKey,
                hookData,
                deployer, // receiver
                block.timestamp + 1 // deadline
            )
        );

        require(success, "Swap failed");

        vm.stopBroadcast();
    }
}
