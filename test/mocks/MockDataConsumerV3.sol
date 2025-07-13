// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockDataConsumerV3 {
    int256 private price = 3000 * 1e8; // 1 ETH = 3000 USD, with 8 decimals (Chainlink standard)
    uint80 private roundId = 1;
    uint256 private timestamp = block.timestamp;

    // Mimics Chainlink AggregatorV3Interface's latestRoundData
    function latestRoundData()
        external
        view
        returns (
            uint80, // roundId
            int256, // answer
            uint256, // startedAt
            uint256, // updatedAt
            uint80 // answeredInRound
        )
    {
        return (roundId, price, timestamp, timestamp, roundId);
    }

    // Mimics DataConsumerV3's getChainlinkDataFeedLatestAnswer
    function getChainlinkDataFeedLatestAnswer() external view returns (int256) {
        return price;
    }

    // Allow setting price for testing
    function setPrice(int256 _price) external {
        price = _price;
    }
}