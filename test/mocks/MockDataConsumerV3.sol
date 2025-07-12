// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockDataConsumerV3 {
    /// @dev Always returns 3000 USDC per ETH (8-decimal Chainlink format)
    function getChainlinkDataFeedLatestAnswer() external pure returns (int256) {
        return 3000 * 1e8;
    }
}