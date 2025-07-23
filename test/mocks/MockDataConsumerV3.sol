// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract MockDataConsumerV3 {
    AggregatorV3Interface internal dataFeed;

    constructor() {
        // Use a mock aggregator that we control
        dataFeed = AggregatorV3Interface(address(new MockAggregatorV3()));
    }

    /// @dev Returns the latest answer from the mock aggregator
    function getChainlinkDataFeedLatestAnswer() external view returns (int256) {
        (, int256 answer, , , ) = dataFeed.latestRoundData();
        return answer;
    }
}

contract MockAggregatorV3 is AggregatorV3Interface {
    /// @dev Always returns 3000 USDC per ETH (8-decimal Chainlink format)
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (1, 3000 * 1e8, block.timestamp, block.timestamp, 1);
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function description() external pure returns (string memory) {
        return "ETH/USD";
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (1, 3000 * 1e8, block.timestamp, block.timestamp, 1);
    }
}
