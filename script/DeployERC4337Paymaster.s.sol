// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {Paymaster, IEntryPoint} from "../src/Paymaster.sol";

contract DeployERC4337PaymasterScript is Script {
    // Sepolia EntryPoint address
    address constant SEPOLIA_ENTRYPOINT =
        0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    // Circle Paymaster Integration address (your deployed hook)
    address constant CIRCLE_PAYMASTER_INTEGRATION =
        0x194CC08EFeD09BE41E94b9Bb4c5Aa265662B428e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast();

        console.log("Deploying ERC-4337 Paymaster...");
        console.log("Deployer:", deployer);
        console.log("EntryPoint:", SEPOLIA_ENTRYPOINT);

        // Deploy the ERC-4337 Paymaster
        Paymaster paymaster = new Paymaster(IEntryPoint(SEPOLIA_ENTRYPOINT));

        console.log("ERC-4337 Paymaster deployed at:", address(paymaster));

        vm.stopBroadcast();

        console.log("ERC-4337 Paymaster deployment completed!");
        console.log("Paymaster address:", address(paymaster));
        console.log("Next steps:");
        console.log(
            "1. Add stake: paymaster.addStake{value: 0.1 ether}(86400)"
        );
        console.log(
            "2. Authorize hook: paymaster.setAuthorizedHook(",
            CIRCLE_PAYMASTER_INTEGRATION,
            ", true)"
        );
    }
}
