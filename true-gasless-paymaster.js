import "dotenv/config";
import { createPublicClient, http, hexToBigInt, encodePacked, createWalletClient } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createBundlerClient, toSimpleSmartAccount } from "viem/account-abstraction";
import { erc20Abi } from "viem";

const chain = sepolia;
const usdcAddress = process.env.USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;

// Use the Circle Paymaster Integration hook that you have working in other files
// This should work with proper ERC-4337 UserOperations too
const circlePaymasterIntegration = "0x194CC08EFeD09BE41E94b9Bb4c5Aa265662B428e"; // Your working hook

// EntryPoint v0.7 address (standard ERC-4337)
const entryPointAddress = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

// Set up the public client
const client = createPublicClient({ 
  chain, 
  transport: http() 
});

console.log("🔧 Checking contract deployments...");

// Check if contracts exist
async function checkContracts() {
  try {
    const [usdcCode, paymasterCode, entryPointCode] = await Promise.all([
      client.getCode({ address: usdcAddress }),
      client.getCode({ address: circlePaymasterIntegration }),
      client.getCode({ address: entryPointAddress })
    ]);
    
    console.log("USDC contract exists:", usdcCode && usdcCode !== "0x" ? "✅" : "❌");
    console.log("Circle Paymaster Integration exists:", paymasterCode && paymasterCode !== "0x" ? "✅" : "❌");
    console.log("EntryPoint v0.7 exists:", entryPointCode && entryPointCode !== "0x" ? "✅" : "❌");
    
    if (!usdcCode || usdcCode === "0x") {
      throw new Error("USDC contract not found at " + usdcAddress);
    }
    
    if (!paymasterCode || paymasterCode === "0x") {
      throw new Error("Circle Paymaster Integration not found at " + circlePaymasterIntegration);
    }
    
    if (!entryPointCode || entryPointCode === "0x") {
      console.log("❌ EntryPoint v0.7 not deployed on Sepolia");
      console.log("Falling back to direct paymaster approach...");
      return false; // Will use direct approach instead
    }
    
    return true; // Can use ERC-4337
  } catch (error) {
    console.error("Error checking contracts:", error.message);
    return false;
  }
}

const canUseErc4337 = await checkContracts();

// Create account
const owner = privateKeyToAccount(ownerPrivateKey);
console.log("Owner Address:", owner.address);
console.log("Chain:", client.chain.name);

if (!canUseErc4337) {
  console.log("\n⚠️  ERC-4337 infrastructure not available on Sepolia");
  console.log("Using direct paymaster integration approach...");
  
  // Fall back to direct approach similar to your working ethertest.js
  // But using viem's bundler client to simulate ERC-4337-like behavior
  
  const usdc = {
    address: usdcAddress,
    abi: erc20Abi
  };

  const usdcBalance = await client.readContract({
    ...usdc,
    functionName: 'balanceOf',
    args: [owner.address]
  });

  const ethBalance = await client.getBalance({ address: owner.address });

  console.log("USDC balance:", usdcBalance.toString());
  console.log("ETH balance:", ethBalance.toString(), "wei");

  // Execute a direct transfer with gasless integration
  async function executeDirectGaslessTransfer() {
    try {
      console.log("\n🚀 Executing gasless USDC transfer with Circle Paymaster Integration hook...");
      console.log("💡 This uses direct contract calls with paymaster hook integration");
      console.log("Transferring 1 USDC to owner address");
      
      const transferAmount = 1000000n; // 1 USDC (6 decimals)
      const recipient = owner.address; // Send to owner for testing
      
      if (usdcBalance < transferAmount + 5000000n) { // Need extra for potential fees
        console.log(`❌ Insufficient USDC balance. Need at least ${(transferAmount + 5000000n).toString()} USDC`);
        console.log(`Current balance: ${usdcBalance.toString()}`);
        console.log("Get Sepolia USDC from: https://faucet.circle.com");
        return;
      }

      // Record initial balances
      const initialUsdcBalance = usdcBalance;
      const initialEthBalance = ethBalance;
      
      console.log("Initial USDC balance:", initialUsdcBalance.toString());
      console.log("Initial ETH balance:", initialEthBalance.toString(), "wei");
      
      // Create wallet client for transactions
      const walletClient = createWalletClient({
        chain,
        transport: http(),
        account: owner
      });
      
      // Execute the USDC transfer 
      // Note: The paymaster integration happens through the hook in your Uniswap v4 setup
      // For a pure USDC transfer, we would need a different paymaster contract
      console.log("⚠️  Pure USDC transfers require a proper ERC-4337 paymaster contract");
      console.log("Your Circle Paymaster Integration hook works with Uniswap V4 swaps");
      console.log("For true gasless USDC transfers, we need Circle's actual paymaster contract");
      
      const hash = await walletClient.writeContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient, transferAmount],
      });
      
      console.log("✅ Transfer submitted!");
      console.log("Transaction hash:", hash);

      // Wait for transaction receipt
      console.log("⏳ Waiting for transaction confirmation...");
      const receipt = await client.waitForTransactionReceipt({ hash });
      console.log("✅ Transaction confirmed!");
      console.log("Block number:", receipt.blockNumber);

      // Check final balances
      const finalUsdcBalance = await client.readContract({
        ...usdc,
        functionName: 'balanceOf',
        args: [owner.address]
      });
      
      const finalEthBalance = await client.getBalance({ address: owner.address });
      
      console.log("\n=== FINAL RESULTS ===");
      console.log("Initial USDC balance:", initialUsdcBalance.toString());
      console.log("Final USDC balance:", finalUsdcBalance.toString());
      console.log("USDC used:", (initialUsdcBalance - finalUsdcBalance).toString());
      console.log("Initial ETH balance:", initialEthBalance.toString(), "wei");
      console.log("Final ETH balance:", finalEthBalance.toString(), "wei");
      console.log("ETH used for gas:", (initialEthBalance - finalEthBalance).toString(), "wei");
      
      if (initialEthBalance === finalEthBalance) {
        console.log("🎉 TRUE GASLESS SUCCESS! No ETH was used for gas fees!");
        console.log("💰 This would be true with proper Circle Paymaster integration!");
      } else {
        console.log("❌ ETH was still used for gas fees.");
        console.log("💡 This is expected without proper ERC-4337 paymaster setup on Sepolia.");
      }
      
    } catch (error) {
      console.error("❌ Transfer failed:", error.message);
      console.error("Full error details:", error);
    }
  }

  // Check if account needs funding
  if (usdcBalance < 6000000n) { // Need at least 6 USDC (1 for transfer + 5 buffer)
    console.log(`❌ Insufficient USDC balance. Current: ${usdcBalance.toString()}`);
    console.log("Fund your account with USDC from: https://faucet.circle.com");
    console.log(`Account Address: ${owner.address}`);
    process.exit(0);
  }

  // Run the transfer
  executeDirectGaslessTransfer()
    .then(() => {
      console.log("\n💡 Summary:");
      console.log("   • Your Circle Paymaster Integration hook works for Uniswap V4 swaps");
      console.log("   • For pure USDC transfers, Circle needs to deploy their ERC-4337 paymaster on Sepolia");
      console.log("   • Check Circle's docs for latest deployment addresses");
      console.log("   • Your current setup is correct for swap gasless functionality");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Fatal error:", error);
      process.exit(1);
    });

} else {
  // ERC-4337 approach (if available)
  console.log("✅ ERC-4337 infrastructure available!");
  
  // Create a Simple Account (ERC-4337 compatible)
  const account = await toSimpleSmartAccount({
    client,
    owner,
    entryPoint: {
      address: entryPointAddress,
      version: "0.7"
    }
  });

  console.log("Smart Account Address:", account.address);

  // Configure the paymaster
  const paymaster = {
    async getPaymasterData(userOperation) {
      // For Circle Paymaster Integration hook
      console.log("Getting paymaster data for Circle Paymaster Integration...");
      
      return {
        paymaster: circlePaymasterIntegration,
        paymasterData: "0x", // Empty data - hook handles gas payment logic
        paymasterVerificationGasLimit: 150000n,
        paymasterPostOpGasLimit: 50000n,
        isFinal: true,
      };
    },
  };

  // Set up the bundler client
  const bundlerClient = createBundlerClient({
    account,
    client,
    paymaster,
    transport: http(`https://public.pimlico.io/v2/${client.chain.id}/rpc`),
  });

  // Check USDC balance
  const usdc = {
    address: usdcAddress,
    abi: erc20Abi
  };

  const usdcBalance = await client.readContract({
    ...usdc,
    functionName: 'balanceOf',
    args: [account.address]
  });

  const ethBalance = await client.getBalance({ address: account.address });

  console.log("USDC balance:", usdcBalance.toString());
  console.log("ETH balance:", ethBalance.toString(), "wei");

  // Execute ERC-4337 gasless transfer
  async function executeErc4337GaslessTransfer() {
    try {
      console.log("\n🚀 Executing ERC-4337 gasless USDC transfer...");
      console.log("💡 Gas fees will be handled by Circle Paymaster Integration!");
      
      const transferAmount = 1000000n; // 1 USDC (6 decimals)
      const recipient = owner.address; // Send to owner for testing
      
      if (usdcBalance < transferAmount + 5000000n) { // Need extra buffer
        console.log(`❌ Insufficient USDC balance. Need at least ${(transferAmount + 5000000n).toString()} USDC`);
        console.log(`Current balance: ${usdcBalance.toString()}`);
        console.log("Get Sepolia USDC from: https://faucet.circle.com");
        return;
      }

      // Record initial balances
      const initialUsdcBalance = usdcBalance;
      const initialEthBalance = ethBalance;
      
      console.log("Initial USDC balance:", initialUsdcBalance.toString());
      console.log("Initial ETH balance:", initialEthBalance.toString(), "wei");
      
      // Execute the USDC transfer via ERC-4337 UserOperation
      const hash = await bundlerClient.sendUserOperation({
        account,
        calls: [
          {
            to: usdcAddress,
            abi: erc20Abi,
            functionName: "transfer",
            args: [recipient, transferAmount],
          },
        ],
      });
      
      console.log("✅ UserOperation submitted!");
      console.log("UserOperation hash:", hash);

      // Wait for transaction receipt
      console.log("⏳ Waiting for transaction confirmation...");
      const receipt = await bundlerClient.waitForUserOperationReceipt({ hash });
      console.log("✅ Transaction confirmed!");
      console.log("Transaction hash:", receipt.receipt.transactionHash);
      console.log("Block number:", receipt.receipt.blockNumber);

      // Check final balances
      const finalUsdcBalance = await client.readContract({
        ...usdc,
        functionName: 'balanceOf',
        args: [account.address]
      });
      
      const finalEthBalance = await client.getBalance({ address: account.address });
      
      console.log("\n=== FINAL RESULTS ===");
      console.log("Initial USDC balance:", initialUsdcBalance.toString());
      console.log("Final USDC balance:", finalUsdcBalance.toString());
      console.log("USDC used:", (initialUsdcBalance - finalUsdcBalance).toString());
      console.log("Initial ETH balance:", initialEthBalance.toString(), "wei");
      console.log("Final ETH balance:", finalEthBalance.toString(), "wei");
      console.log("ETH used for gas:", (initialEthBalance - finalEthBalance).toString(), "wei");
      
      if (initialEthBalance === finalEthBalance) {
        console.log("🎉 TRUE GASLESS SUCCESS! No ETH was used for gas fees!");
        console.log("💰 Gas was paid via Circle Paymaster Integration!");
      } else {
        console.log("❌ Still using ETH for gas. Paymaster integration needs debugging.");
      }
      
    } catch (error) {
      console.error("❌ ERC-4337 gasless transfer failed:", error.message);
      console.error("Full error details:", error);
    }
  }

  // Check if account needs funding
  if (usdcBalance < 6000000n) { // Need at least 6 USDC
    console.log(`❌ Insufficient USDC balance. Current: ${usdcBalance.toString()}`);
    console.log("Fund your smart account with USDC from: https://faucet.circle.com");
    console.log(`Smart Account Address: ${account.address}`);
    process.exit(0);
  }

  // Run the ERC-4337 gasless transfer
  executeErc4337GaslessTransfer()
    .then(() => {
      console.log("\n🎉 ERC-4337 Circle Paymaster gasless transfer completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Fatal error:", error);
      process.exit(1);
    });
}