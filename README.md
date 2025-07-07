# CirclePaymasterHook

**CirclePaymasterHook** is a Uniswap V4 hook that enables users to pay gas fees in USDC (instead of ETH) for swap operations, leveraging Circle's ERC-4337 Paymaster service. This makes DeFi more accessible by allowing gasless transactions, improving user experience, and reducing friction for stablecoin users.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Installation](#installation)
- [Deployment & Integration](#deployment--integration)
- [Usage](#usage)
- [Testing](#testing)
- [Security](#security)
- [Future Improvements](#future-improvements)
- [Addresses](#addresses)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## Overview

CirclePaymasterHook allows users to pay Uniswap V4 swap gas fees in USDC, using Circle's ERC-4337 Paymaster. This removes the need for users to hold ETH for gas, making DeFi more user-friendly and cost-efficient.

---

## Architecture

The system is composed of three main contracts:

1. **CirclePaymasterHook**

   - Uniswap V4 hook that manages gas payments in USDC.
   - Handles gas estimation, USDC transfers, and refunds.
   - Interacts with the CirclePaymasterIntegration contract.

2. **CirclePaymasterIntegration**

   - Receives USDC from users and manages deposits.
   - Interacts with the Circle Paymaster contract.
   - Handles refunds and relayer reimbursements.

3. **Paymaster**
   - ERC-4337 Paymaster implementation.
   - Validates user operations and manages ETH deposits.
   - Authorizes hooks for integration.

---

## Features

- **Gasless Swaps:** Users pay gas in USDC, not ETH.
- **Circle Paymaster Integration:** Secure, efficient gas payment processing.
- **Dynamic Gas Estimation:** Converts gas cost to USDC using a configurable rate.
- **Refund Mechanism:** Returns excess USDC if actual gas used is less than estimated.
- **Admin Controls:** Update USDC/ETH rates, manage authorized contracts, and emergency withdrawals.
- **Security:** Uses OpenZeppelin's Ownable and ReentrancyGuard.

---

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-team/circle-paymaster-hook.git
   cd circle-paymaster-hook
   ```

2. **Install dependencies:**

   ```bash
   forge install
   ```

3. **Compile contracts:**
   ```bash
   forge build
   ```

---

## Deployment & Integration

1. **Deploy Paymaster:**  
   Deploy `Paymaster.sol` with the EntryPoint address.

2. **Deploy CirclePaymasterIntegration:**  
   Deploy with the Circle Paymaster and USDC token addresses.

3. **Deploy CirclePaymasterHook:**  
   Deploy with the Uniswap V4 PoolManager, CirclePaymasterIntegration, and USDC addresses.

4. **Authorize the Hook:**  
   Use `setAuthorizedHook` in the Paymaster contract to authorize the deployed hook.

5. **Configure USDC/ETH Rate:**  
   Update the rate as needed:
   ```solidity
   CirclePaymasterHook.updateUsdcToEthRate(newRate);
   ```

---

## Usage

### Initiate a Swap

- Call the Uniswap V4 pool with CirclePaymasterHook enabled.
- Pass hook data:
  - For gasless mode: `abi.encode(true, userAddress)`
  - For standard mode: `abi.encode(false)`

### Monitor Events

- `GasPaymentProcessed`: USDC paid and gas used.
- `PaymasterDeposit`: ETH deposits to Circle Paymaster.
- `RelayerReimbursed`: USDC reimbursements to relayers.

### View Functions

- `getGasEstimate(user)`: Returns estimated ETH and USDC cost for a swap.
- `getUserCirclePaymasterDeposit(user)`: Returns the user's USDC deposit.

---

## Testing

Run all tests using Foundry:

```bash
forge test
```

Test coverage includes:

- Gas payment and refund logic
- USDC transfers and allowances
- Paymaster validation and post-operation handling
- Edge cases (insufficient balances, unauthorized callers)

---

## Security

- **Access Control:** Only authorized callers can perform sensitive operations.
- **Reentrancy Protection:** Uses OpenZeppelin's ReentrancyGuard.
- **Emergency Functions:** Owner can withdraw USDC/ETH in emergencies.

---

## Future Improvements

- Integrate Chainlink for real-time USDC/ETH price feeds.
- Support additional stablecoins (DAI, USDT).
- Enhance gas estimation with dynamic profiling.
- Add multi-network support.

---

## Addresses

**Circle Paymaster Addresses:**

- Arbitrum Mainnet: `0x6C973eBe80dCD8660841D4356bf15c32460271C9`
- Arbitrum Testnet: `0x31BE08D380A21fc740883c0BC434FcFc88740b58`
- Base Mainnet: `0x6C973eBe80dCD8660841D4356bf15c32460271C9`
- Base Testnet: `0x31BE08D380A21fc740883c0BC434FcFc88740b58`

---

## License

MIT License. See SPDX identifiers in contract files.

---

## Acknowledgements

- Uniswap V4 for the hook architecture.
- Circle for the ERC-4337 Paymaster service.
- OpenZeppelin for secure contract primitives.

---

**For detailed contract-level documentation, see the NatSpec comments in each contract file.**
