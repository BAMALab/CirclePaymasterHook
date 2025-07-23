import "dotenv/config";
import { createPublicClient, http, encodePacked } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Configuration
const chain = sepolia;
const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
const swapRouterAddress = "0x00000000000044a361Ae3cAc094c9D1b14Eece97"; // Uniswap V4 Router
const circlePaymasterIntegration = "0x194CC08EFeD09BE41E94b9Bb4c5Aa265662B428e"; // Your hook

// User configuration - address with USDC but no ETH
const ownerPrivateKey = "0x1cdc0890efa3dc7f5d72a128d57eb1ead4c0aac76e37523d9d1ffb2755ae23ab";
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
  hooks
];

// Hook data for gasless mode
const hookData = encodePacked(
  ["bool", "address"],
  [true, userAddress] // gasless mode, user address
);

// Set up client
const client = createPublicClient({ chain, transport: http() });

console.log("🔧 Setting up gasless swap with Circle Paymaster Integration");
console.log("User address:", userAddress);
console.log("Chain:", client.chain.name);
console.log("Circle Paymaster Integration:", circlePaymasterIntegration);

// USDC ABI
const usdcAbi = [
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" }
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
];

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
          { internalType: "address", name: "hooks", type: "address" }
        ],
        internalType: "struct PoolKey",
        name: "poolKey",
        type: "tuple"
      },
      { internalType: "bytes", name: "hookData", type: "bytes" },
      { internalType: "address", name: "receiver", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" }
    ],
    name: "swapExactTokensForTokens",
    outputs: [{ internalType: "int256", name: "", type: "int256" }],
    stateMutability: "payable",
    type: "function"
  }
];

// Check USDC balance
async function checkBalance() {
  const balance = await client.readContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: [userAddress]
  });
  
  console.log("USDC balance:", balance.toString());
  return balance;
}

// Check allowances
async function checkAllowances() {
  const routerAllowance = await client.readContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: 'allowance',
    args: [userAddress, swapRouterAddress]
  });
  
  const paymasterAllowance = await client.readContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: 'allowance',
    args: [userAddress, circlePaymasterIntegration]
  });
  
  console.log("Router allowance:", routerAllowance.toString());
  console.log("Paymaster allowance:", paymasterAllowance.toString());
  
  return { routerAllowance, paymasterAllowance };
}

// Execute gasless swap using your existing hook system
async function executeGaslessSwap() {
  try {
    console.log("\n🚀 Executing gasless swap with Circle Paymaster Integration...");
    console.log("Amount in:", amountIn.toString(), "USDC");
    console.log("Pool key:", poolKey);
    console.log("Hook data:", hookData);
    console.log("Paymaster:", circlePaymasterIntegration);
    
    // Check current allowances
    const { routerAllowance, paymasterAllowance } = await checkAllowances();
    
    // Check if approvals are needed
    if (routerAllowance < amountIn) {
      console.log("❌ Router approval needed. This requires ETH for gas.");
      console.log("   You need to approve USDC for the router first.");
      console.log("   Router address:", swapRouterAddress);
      console.log("   Required amount:", amountIn.toString());
      return;
    }
    
    if (paymasterAllowance < amountIn) {
      console.log("❌ Paymaster approval needed. This requires ETH for gas.");
      console.log("   You need to approve USDC for the Circle Paymaster Integration first.");
      console.log("   Paymaster address:", circlePaymasterIntegration);
      console.log("   Required amount:", amountIn.toString());
      return;
    }
    
    console.log("✅ All approvals are in place!");
    console.log("✅ Ready to execute gasless swap!");
    
    // Simulate the swap to check if it would succeed
    console.log("\n🔍 Simulating swap...");
    try {
      const result = await client.simulateContract({
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
          deadline
        ],
        account: userAddress
      });
      
      console.log("✅ Swap simulation successful!");
      console.log("Result:", result);
      
      console.log("\n🎉 GASLESS SWAP READY!");
      console.log("✅ User has sufficient USDC balance");
      console.log("✅ All approvals are in place");
      console.log("✅ Hook data is properly encoded");
      console.log("✅ Swap simulation passed");
      console.log("");
      console.log("📋 To execute the swap:");
      console.log("1. Use your existing ethertest.js script");
      console.log("2. Or call the swap router directly with the hook data");
      console.log("3. The Circle Paymaster Integration hook will handle gas payment in USDC");
      
    } catch (simulationError) {
      console.error("❌ Swap simulation failed:", simulationError.message);
      console.error("This might indicate:");
      console.error("- Insufficient liquidity in the pool");
      console.error("- Hook contract issues");
      console.error("- Incorrect pool parameters");
    }
    
  } catch (error) {
    console.error("❌ Gasless swap setup failed:", error.message);
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
    
    // Execute swap setup
    await executeGaslessSwap();
    
  } catch (error) {
    console.error("❌ Fatal error:", error);
  }
}

// Run the gasless swap
main().then(() => {
  console.log("\n🎉 Gasless swap analysis completed!");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}); 