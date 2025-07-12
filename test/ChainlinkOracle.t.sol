// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/oracle/DataConsumerV3.sol";

contract ChainlinkOracleTest is Test {
    DataConsumerV3 oracle;

    // Sepolia ETH/USD feed
    address constant ETH_USD = 0x694AA1769357215DE4FAC081bf1f309aDC325306;

    function setUp() public {
        vm.createSelectFork(vm.envString("SEPOLIA_RPC"));

        oracle = new DataConsumerV3();
    }

    function testPrice() public view {
        int256 p = oracle.getChainlinkDataFeedLatestAnswer();
        assertGt(p, 1000e8); // price is 8 decimals
    }
}
