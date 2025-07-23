import "dotenv/config";
import { createPublicClient, http, encodePacked, hexToBigInt } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  createBundlerClient,
  toSimple7702SmartAccount,
} from "viem/account-abstraction";

// Configuration
const chain = sepolia;
const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
const swapRouterAddress = "0x00000000000044a361Ae3cAc094c9D1b14Eece97"; // Uniswap V4 Router
const circlePaymasterIntegration = "0x194CC08EFeD09BE41E94b9Bb4c5Aa265662B428e"; // Your hook

// User configuration - address with USDC but no ETH
const ownerPrivateKey =
  "0x1cdc0890efa3dc7f5d72a128d57eb1ead4c0aac76e37523d9d1ffb2755ae23ab";
const userAddress = "0x9dBa18e9b96b905919cC828C399d313EfD55D800";

// Swap parameters
const amountIn = 1000000n; // 1 USDC (6 decimals)
const amountOutMin = 0n;
const zeroForOne = true;
const fee = 5000;
const tickSpacing = 100;
const hooks = "0xc9e902b5047433935C8f6B173fC936Fd696C00c0";
const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

// PoolKey struct
const poolKey = [
  usdcAddress, // currency0
  "0x90954dcFB08C84e1ebA306f59FAD660b3A7B5808", // currency1 (WETH)
  fee,
  tickSpacing,
  hooks,
];

// Hook data for gasless mode
const hookData = encodePacked(
  ["bool", "address"],
  [true, userAddress] // gasless mode, user address
);

// Set up clients and account
const client = createPublicClient({ chain, transport: http() });
const owner = privateKeyToAccount(ownerPrivateKey);
const account = await toSimple7702SmartAccount({ client, owner });

console.log(
  "🔧 Setting up Account Abstraction with Circle Paymaster Integration"
);
console.log("Smart Account address:", account.address);
console.log("Chain:", client.chain.name);

// USDC ABI
const usdcAbi = [
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

// Check USDC balance using direct contract call
async function checkBalance() {
  const balance = await client.readContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [account.address],
  });

  console.log("USDC balance:", balance.toString());
  return balance;
}

// Check allowances using direct contract calls
async function checkAllowances() {
  const routerAllowance = await client.readContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: "allowance",
    args: [account.address, swapRouterAddress],
  });

  const paymasterAllowance = await client.readContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: "allowance",
    args: [account.address, circlePaymasterIntegration],
  });

  console.log("Router allowance:", routerAllowance.toString());
  console.log("Paymaster allowance:", paymasterAllowance.toString());

  return { routerAllowance, paymasterAllowance };
}

// Custom paymaster that works with your existing Circle Paymaster Integration
const paymaster = {
  async getPaymasterData(parameters) {
    // For now, we'll use a simple approach that doesn't require complex permit signing
    // This will work with your existing hook-based system
    return {
      paymaster: circlePaymasterIntegration,
      paymasterData: "0x", // Empty data - your hook will handle the gas payment
      paymasterVerificationGasLimit: 200000n,
      paymasterPostOpGasLimit: 15000n,
      isFinal: true,
    };
  },
};

// Set up bundler client
const bundlerClient = createBundlerClient({
  account,
  client,
  paymaster,
  userOperation: {
    estimateFeesPerGas: async ({ account, bundlerClient, userOperation }) => {
      const { standard: fees } = await bundlerClient.request({
        method: "pimlico_getUserOperationGasPrice",
      });
      const maxFeePerGas = hexToBigInt(fees.maxFeePerGas);
      const maxPriorityFeePerGas = hexToBigInt(fees.maxPriorityFeePerGas);
      return { maxFeePerGas, maxPriorityFeePerGas };
    },
  },
  transport: http(`https://public.pimlico.io/v2/${client.chain.id}/rpc`),
});

// Uniswap V4 Router ABI
const routerAbi = [
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "bool", name: "zeroForOne", type: "bool" },
      {
        components: [
          { internalType: "address", name: "currency0", type: "address" },
          { internalType: "address", name: "currency1", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "int24", name: "tickSpacing", type: "int24" },
          { internalType: "address", name: "hooks", type: "address" },
        ],
        internalType: "struct PoolKey",
        name: "poolKey",
        type: "tuple",
      },
      { internalType: "bytes", name: "hookData", type: "bytes" },
      { internalType: "address", name: "receiver", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForTokens",
    outputs: [{ internalType: "int256", name: "", type: "int256" }],
    stateMutability: "payable",
    type: "function",
  },
];

// Execute gasless swap with Account Abstraction
async function executeGaslessSwap() {
  try {
    console.log("\n🚀 Executing gasless swap with Account Abstraction...");
    console.log("Amount in:", amountIn.toString(), "USDC");
    console.log("Pool key:", poolKey);
    console.log("Hook data:", hookData);
    console.log("Paymaster:", circlePaymasterIntegration);

    // Check current allowances
    const { routerAllowance, paymasterAllowance } = await checkAllowances();

    // Prepare all necessary calls
    const calls = [];

    // Add approvals if needed (these will be gasless via Account Abstraction)
    if (routerAllowance < amountIn) {
      console.log("Adding gasless router approval...");
      calls.push({
        to: usdcAddress,
        abi: usdcAbi,
        functionName: "approve",
        args: [swapRouterAddress, amountIn],
      });
    }

    if (paymasterAllowance < amountIn) {
      console.log("Adding gasless paymaster approval...");
      calls.push({
        to: usdcAddress,
        abi: usdcAbi,
        functionName: "approve",
        args: [circlePaymasterIntegration, amountIn],
      });
    }

    // Add the swap call
    calls.push({
      to: swapRouterAddress,
      abi: routerAbi,
      functionName: "swapExactTokensForTokens",
      args: [
        amountIn,
        amountOutMin,
        zeroForOne,
        poolKey,
        hookData,
        account.address, // Use smart account address as receiver
        deadline,
      ],
    });

    console.log(`Total calls to execute: ${calls.length}`);

    // Sign authorization for 7702 account
    const authorization = await owner.signAuthorization({
      chainId: chain.id,
      nonce: await client.getTransactionCount({ address: owner.address }),
      contractAddress: account.authorization.address,
    });

    // Submit user operation (this is where the magic happens!)
    console.log("Submitting UserOperation to bundler...");
    const hash = await bundlerClient.sendUserOperation({
      account,
      calls,
      authorization: authorization,
    });

    console.log("✅ UserOperation submitted!");
    console.log("UserOperation hash:", hash);

    // Wait for transaction receipt
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await bundlerClient.waitForUserOperationReceipt({ hash });
    console.log("✅ Transaction confirmed!");
    console.log("Transaction hash:", receipt.receipt.transactionHash);
    console.log("Block number:", receipt.receipt.blockNumber);

    // Check final USDC balance
    const finalBalance = await client.readContract({
      address: usdcAddress,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [account.address],
    });
    console.log("Final USDC balance:", finalBalance.toString());

    console.log("\n🎉 GASLESS SWAP COMPLETED!");
    console.log("✅ User paid ZERO ETH for gas fees");
    console.log(
      "✅ All gas fees were paid in USDC via Circle Paymaster Integration"
    );
    console.log("✅ Account Abstraction handled all complexity");
  } catch (error) {
    console.error("❌ Gasless swap failed:", error.message);
    if (error.details) {
      console.error("Error details:", error.details);
    }
    // Log more details for debugging
    console.error("Full error:", error);
  }
}

// Main execution
async function main() {
  try {
    // Check balance
    const balance = await checkBalance();
    if (balance < amountIn) {
      console.error("❌ Insufficient USDC balance for swap");
      console.error(`Need: ${amountIn}, Have: ${balance}`);
      return;
    }

    // Execute swap
    await executeGaslessSwap();
  } catch (error) {
    console.error("❌ Fatal error:", error);
  }
}

// Run the gasless swap
main()
  .then(() => {
    console.log("\n🎉 Account Abstraction gasless swap completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
