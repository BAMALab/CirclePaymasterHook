// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Hooks} from "v4-core/libraries/Hooks.sol";

/// @title HookMiner
/// @notice Utility contract for mining hook addresses with specific flags
library HookMiner {
    
    /// @notice Find a salt that will produce a hook address with the desired flags
    /// @param deployer The address that will deploy the hook
    /// @param flags The desired flags for the hook address
    /// @param creationCode The creation code of the hook contract
    /// @param constructorArgs The encoded constructor arguments
    /// @return hookAddress The address where the hook will be deployed
    /// @return salt The salt that produces the desired address
    function find(
        address deployer,
        uint160 flags,
        bytes memory creationCode,
        bytes memory constructorArgs
    ) internal pure returns (address hookAddress, bytes32 salt) {
        bytes memory bytecode = abi.encodePacked(creationCode, constructorArgs);
        
        for (uint256 i = 0; i < 100000; i++) {
            salt = keccak256(abi.encodePacked(i));
            hookAddress = computeAddress(deployer, salt, bytecode);
            
            if (uint160(hookAddress) & flags == flags) {
                return (hookAddress, salt);
            }
        }
        
        revert("HookMiner: Could not find salt");
    }
    
    /// @notice Compute the address of a contract deployed with CREATE2
    /// @param deployer The address that will deploy the contract
    /// @param salt The salt used in CREATE2
    /// @param bytecode The bytecode of the contract
    /// @return The computed address
    function computeAddress(
        address deployer,
        bytes32 salt,
        bytes memory bytecode
    ) internal pure returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                deployer,
                salt,
                keccak256(bytecode)
            )
        );
        
        return address(uint160(uint256(hash)));
    }
}