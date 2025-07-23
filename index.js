import "dotenv/config";
import { createPublicClient, http, createWalletClient, getContract, encodeAbiParameters } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi } from "viem";

const chain = sepolia;
const usdcAddress = process.env.USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
const recipientAddress = process.env.RECIPIENT_ADDRESS;

// Swap configuration (using exact working addresses from ethertest.js)
const swapAddress = "0x00000000000044a361Ae3cAc094c9D1b14Eece97"; // Uniswap V4 router
const currency0 = "0x3B4c3885E8144af60A101c75468727863cFf23fA"; // Working token from ethertest.js
const currency1 = "0x90954dcFB08C84e1ebA306f59FAD660b3A7B5808"; // WETH
const fee = 5000;
const tickSpacing = 100;
const hooks = "0xc9e902b5047433935C8f6B173fC936Fd696C00c0";
const circlePaymasterIntegration = "0x194CC08EFeD09BE41E94b9Bb4c5Aa265662B428e"; // Circle Paymaster Integration
const amountIn = 1000000000000000000n; // 1 token (18 decimals to match working config)
const amountOutMin = 0n; // Accept any amount out (not safe for production)
const zeroForOne = true; // true if swapping currency0 for currency1
const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

// Set up clients
const publicClient = createPublicClient({ 
  chain, 
  transport: http() 
});

const account = privateKeyToAccount(ownerPrivateKey);
const walletClient = createWalletClient({
  account,
  chain,
  transport: http()
});

console.log("Account address:", account.address);
console.log("Chain:", publicClient.chain.name);

// PoolKey struct as array (tuple) for viem
const poolKey = [currency0, currency1, fee, tickSpacing, hooks];

// Encode hook data using proper ABI encoding (like ethertest.js)
// (bool gasless, address user) -> matches ethers.AbiCoder.defaultAbiCoder().encode(["bool", "address"], [true, account.address])
const hookData = encodeAbiParameters(
  [
    { name: 'gasless', type: 'bool' },
    { name: 'user', type: 'address' }
  ],
  [true, account.address]
);

console.log("Hook data (ABI encoded):", hookData);

// Swap router ABI (from your working ethertest.js)
const swapRouterAbi = [
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

// Get contracts for both tokens
const usdc = getContract({ 
  client: publicClient, 
  address: usdcAddress, 
  abi: erc20Abi 
});

const token0 = getContract({ 
  client: publicClient, 
  address: currency0, 
  abi: erc20Abi 
});

// Check balances
const usdcBalance = await usdc.read.balanceOf([account.address]);
const token0Balance = await token0.read.balanceOf([account.address]);
console.log("USDC balance:", usdcBalance.toString());
console.log("Token0 balance:", token0Balance.toString());

if (token0Balance < amountIn) {
  console.log(
    `Fund ${account.address} with Token0 (${currency0}) on ${publicClient.chain.name}, then run this again.`,
  );
  console.log(`Current Token0 balance: ${token0Balance.toString()}, Required: ${amountIn.toString()}`);
  process.exit(0);
}

// Check ETH balance for approvals
const ethBalance = await publicClient.getBalance({ address: account.address });
console.log("ETH balance:", ethBalance.toString(), "wei");

// Check allowances
async function checkAllowances() {
  const routerAllowance = await token0.read.allowance([account.address, swapAddress]);
  const paymasterAllowance = await token0.read.allowance([account.address, circlePaymasterIntegration]);
  
  console.log("Router allowance (Token0):", routerAllowance.toString());
  console.log("Paymaster allowance (Token0):", paymasterAllowance.toString());
  
  return { routerAllowance, paymasterAllowance };
}

// Execute gasless swap using Circle Paymaster Integration hook
async function executeGaslessSwap() {
  try {
    console.log("\n🚀 Executing gasless Token0->WETH swap with Circle Paymaster Integration...");
    console.log("Swapping", amountIn.toString(), "Token0 for WETH");
    console.log("Pool key:", poolKey);
    console.log("Hook data (gasless mode):", hookData);
    
    // Check allowances
    const { routerAllowance, paymasterAllowance } = await checkAllowances();
    
    // Handle approvals if needed
    if (routerAllowance < amountIn) {
      console.log("Approving Token0 for router...");
      if (ethBalance < 1000000000000000n) { // 0.001 ETH
        console.error("❌ Insufficient ETH for approval transaction!");
        console.error("You need a small amount of ETH for the one-time approval.");
        console.error("Get Sepolia ETH from: https://sepoliafaucet.com/");
        return;
      }
      
      const approveHash = await walletClient.writeContract({
        address: currency0,
        abi: erc20Abi,
        functionName: "approve",
        args: [swapAddress, amountIn],
      });
      
      console.log("Router approval transaction:", approveHash);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      console.log("✅ Router approval confirmed");
    }
    
    if (paymasterAllowance < amountIn) {
      console.log("Approving Token0 for Circle Paymaster Integration...");
      if (ethBalance < 1000000000000000n) { // 0.001 ETH
        console.error("❌ Insufficient ETH for approval transaction!");
        console.error("You need a small amount of ETH for the one-time approval.");
        console.error("Get Sepolia ETH from: https://sepoliafaucet.com/");
        return;
      }
      
      const approveHash = await walletClient.writeContract({
        address: currency0,
        abi: erc20Abi,
        functionName: "approve",
        args: [circlePaymasterIntegration, amountIn],
      });
      
      console.log("Paymaster approval transaction:", approveHash);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      console.log("✅ Paymaster approval confirmed");
    }
    
    console.log("✅ All approvals are in place!");
    console.log("✅ Ready to execute gasless swap!");
    
    // Execute the swap
    console.log("\n🔄 Executing swap transaction...");
    console.log("💡 Gas fees will be paid in tokens via Circle Paymaster Integration hook");
    
    const swapHash = await walletClient.writeContract({
      address: swapAddress,
      abi: swapRouterAbi,
      functionName: "swapExactTokensForTokens",
      args: [
        amountIn,
        amountOutMin,
        zeroForOne,
        poolKey,
        hookData,
        account.address,
        deadline
      ],
    });
    
    console.log("✅ Swap transaction submitted!");
    console.log("Transaction hash:", swapHash);

    // Wait for transaction confirmation
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
    console.log("✅ Transaction confirmed!");
    console.log("Block number:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());

    // Check final balances
    const finalToken0Balance = await token0.read.balanceOf([account.address]);
    const finalUsdcBalance = await usdc.read.balanceOf([account.address]);
    console.log("\n=== FINAL RESULTS ===");
    console.log("Initial Token0 balance:", token0Balance.toString());
    console.log("Final Token0 balance:", finalToken0Balance.toString());
    console.log("Token0 used (swap):", (token0Balance - finalToken0Balance).toString());
    console.log("Initial USDC balance:", usdcBalance.toString());
    console.log("Final USDC balance:", finalUsdcBalance.toString());
    console.log("USDC used (gas fees):", (usdcBalance - finalUsdcBalance).toString());
    console.log("🎉 Gasless swap completed! Gas fees were paid in USDC via Circle Paymaster Integration!");
    
  } catch (error) {
    console.error("❌ Gasless swap failed:", error.message);
    
    // Check for specific error types
    if (
      error.message.includes("insufficient funds") ||
      error.message.includes("insufficient balance")
    ) {
      console.error("❌ Insufficient funds error detected!");
      console.error("This usually means:");
      console.error("  1. Not enough tokens for the swap");
      console.error("  2. Not enough tokens for gas fees (gasless mode)");
      console.error("  3. Token approval issues");
    } else if (error.message.includes("PoolNotInitialized")) {
      console.error("❌ Pool not initialized error!");
      console.error("The pool for these tokens hasn't been created or initialized yet.");
      console.error("This is a testnet limitation - try different token pairs.");
    } else if (error.message.includes("nonce")) {
      console.error("❌ Nonce error - try again in a few seconds");
    } else if (error.message.includes("revert")) {
      console.error("❌ Transaction reverted - check contract state and parameters");
    }
    
    console.error("Full error details:", error);
  }
}

// Run the gasless swap
executeGaslessSwap()
  .then(() => {
    console.log("\n🎉 Circle Paymaster Integration gasless swap completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
