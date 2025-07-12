// script/DeployOracle.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "forge-std/Script.sol";
import "../src/oracle/DataConsumerV3.sol";   

contract DeployOracle is Script {
    function run() external {
        vm.startBroadcast();
        // Sepolia ETH/USD feed
        DataConsumerV3 oracle = new DataConsumerV3();   
        console.log("Oracle deployed to:", address(oracle));
        vm.stopBroadcast();
    }
}