// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/oracle/DataConsumerV3.sol";
import "./mocks/MockDataConsumerV3.sol";

contract ChainlinkOracleTest is Test {
    MockDataConsumerV3 oracle;

    function setUp() public {
        // Deploy mock oracle instead of forking Sepolia
        oracle = new MockDataConsumerV3();
        // Set price to 3000 USD/ETH (8 decimals) to match USDC_TO_ETH_RATE
        oracle.setPrice(3000 * 1e8);
    }

    function testPrice() public view {
        int256 p = oracle.getChainlinkDataFeedLatestAnswer();
        assertGt(p, 1000e8); // price is 8 decimals, expect > 1000 USD
    }
}