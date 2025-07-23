import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  encodePacked,
  parseAbi,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

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
const publicClient = createPublicClient({ chain, transport: http() });
const walletClient = createWalletClient({
  account: privateKeyToAccount(ownerPrivateKey),
  chain,
  transport: http(),
});
const account = privateKeyToAccount(ownerPrivateKey);

console.log(
  "🔧 Setting up simple gasless swap with Circle Paymaster Integration"
);
console.log("User address:", userAddress);
console.log("Chain:", publicClient.chain.name);

// USDC ABI
const usdcAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

// Router ABI
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

// Check USDC balance
async function checkBalance() {
  const balance = await publicClient.readContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [userAddress],
  });

  console.log("USDC balance:", balance.toString());
  return balance;
}

// Check allowances
async function checkAllowances() {
  const routerAllowance = await publicClient.readContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: "allowance",
    args: [userAddress, swapRouterAddress],
  });

  const paymasterAllowance = await publicClient.readContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: "allowance",
    args: [userAddress, circlePaymasterIntegration],
  });

  console.log("Router allowance:", routerAllowance.toString());
  console.log("Paymaster allowance:", paymasterAllowance.toString());

  return { routerAllowance, paymasterAllowance };
}

// Approve USDC for router
async function approveRouter() {
  console.log("Approving USDC for router...");

  const hash = await walletClient.writeContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: "approve",
    args: [swapRouterAddress, amountIn],
  });

  console.log("Router approval transaction hash:", hash);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Router approval confirmed");
}

// Approve USDC for paymaster
async function approvePaymaster() {
  console.log("Approving USDC for Circle Paymaster Integration...");

  const hash = await walletClient.writeContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: "approve",
    args: [circlePaymasterIntegration, amountIn],
  });

  console.log("Paymaster approval transaction hash:", hash);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Paymaster approval confirmed");
}

// Execute gasless swap
async function executeGaslessSwap() {
  try {
    console.log("\n🚀 Executing gasless swap...");
    console.log("Amount in:", amountIn.toString(), "USDC");
    console.log("Pool key:", poolKey);
    console.log("Hook data:", hookData);

    const hash = await walletClient.writeContract({
      address: swapRouterAddress,
      abi: routerAbi,
      functionName: "swapExactTokensForTokens",
      args: [
        amountIn,
        amountOutMin,
        zeroForOne,
        poolKey,
        hookData,
        userAddress,
        deadline,
      ],
    });

    console.log("✅ Swap transaction submitted!");
    console.log("Transaction hash:", hash);

    // Wait for transaction receipt
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("✅ Transaction confirmed!");
    console.log("Block number:", receipt.blockNumber);

    // Check final USDC balance
    const finalBalance = await publicClient.readContract({
      address: usdcAddress,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [userAddress],
    });
    console.log("Final USDC balance:", finalBalance.toString());
  } catch (error) {
    console.error("❌ Gasless swap failed:", error.message);
    if (error.details) {
      console.error("Error details:", error.details);
    }
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

    // Check allowances
    const { routerAllowance, paymasterAllowance } = await checkAllowances();

    // Approve if needed
    if (routerAllowance < amountIn) {
      await approveRouter();
    }

    if (paymasterAllowance < amountIn) {
      await approvePaymaster();
    }

    // Execute swap
    await executeGaslessSwap();
  } catch (error) {
    console.error("❌ Fatal error:", error);
  }
}

// Run the script
main()
  .then(() => {
    console.log("\n🎉 Gasless swap completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
 