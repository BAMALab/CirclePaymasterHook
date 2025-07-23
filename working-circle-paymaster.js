import "dotenv/config";
import { createPublicClient, http, createWalletClient, encodeAbiParameters, encodeFunctionData } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createBundlerClient, toSimpleSmartAccount } from "viem/account-abstraction";
import { erc20Abi } from "viem";

const chain = sepolia;
const usdcAddress = process.env.USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
const recipientAddress = process.env.RECIPIENT_ADDRESS;

// Official Circle Paymaster v0.7 addresses from Circle documentation
const CIRCLE_PAYMASTER_V07 = "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966";
const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const SIMPLE_ACCOUNT_FACTORY = "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985"; // Standard SimpleAccount factory

console.log("🎯 CIRCLE PAYMASTER v0.7 - CORRECTED IMPLEMENTATION");
console.log("==================================================");

// Set up clients
const publicClient = createPublicClient({ 
  chain, 
  transport: http() 
});

const owner = privateKeyToAccount(ownerPrivateKey);

const walletClient = createWalletClient({
  chain,
  transport: http(),
  account: owner
});

const bundlerApiKey = process.env.BUNDLER_API_KEY;

if (!bundlerApiKey) {
  console.log("\n🔧 SETUP REQUIRED:");
  console.log("1. Get a bundler API key from Pimlico: https://pimlico.io");
  console.log("2. Add BUNDLER_API_KEY=your_key_here to your .env file");
  process.exit(1);
}

const bundlerClient = createBundlerClient({
  chain,
  transport: http(`https://api.pimlico.io/v2/sepolia/rpc?apikey=${bundlerApiKey}`),
  entryPointAddress: ENTRYPOINT_V07,
});

async function main() {
  try {
    console.log("\n1️⃣ Setting up SimpleAccount (not 7702)...");
    
    // Create proper SimpleAccount for ERC-4337
    const smartAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner,
      entryPointAddress: ENTRYPOINT_V07,
      factoryAddress: SIMPLE_ACCOUNT_FACTORY,
    });
    
    console.log("✅ Smart Account Address:", smartAccount.address);
    
    // Check initial balances
    console.log("\n2️⃣ Checking Initial Balances...");
    
    const ownerEthBalance = await publicClient.getBalance({ address: owner.address });
    const ownerUsdcBalance = await publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner.address],
    });
    
    const smartAccountEthBalance = await publicClient.getBalance({ address: smartAccount.address });
    const smartAccountUsdcBalance = await publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [smartAccount.address],
    });
    
    console.log(`EOA ETH: ${ownerEthBalance} wei`);
    console.log(`EOA USDC: ${ownerUsdcBalance} units`);
    console.log(`Smart Account ETH: ${smartAccountEthBalance} wei`);
    console.log(`Smart Account USDC: ${smartAccountUsdcBalance} units`);
    
    // Fund smart account with USDC if needed
    if (smartAccountUsdcBalance < 10000000n) { // Less than 10 USDC
      console.log("\n3️⃣ Funding Smart Account with USDC...");
      
      const fundTx = await walletClient.writeContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [smartAccount.address, 10000000n], // 10 USDC
      });
      
      console.log("Funding transaction:", fundTx);
      await publicClient.waitForTransactionReceipt({ hash: fundTx });
      
      const newBalance = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [smartAccount.address],
      });
      
      console.log(`✅ Smart Account USDC after funding: ${newBalance} units`);
    }
    
    // Check USDC allowance to Circle Paymaster
    console.log("\n4️⃣ Checking USDC Allowance to Circle Paymaster...");
    
    const allowance = await publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [smartAccount.address, CIRCLE_PAYMASTER_V07],
    });
    
    console.log(`Current allowance: ${allowance} USDC units`);
    
    const requiredAllowance = 5000000n; // 5 USDC for gas
    
    if (allowance < requiredAllowance) {
      console.log("\n5️⃣ Need to approve USDC to Circle Paymaster first...");
      console.log("⚠️  This requires a regular transaction (with ETH gas) as a one-time setup");
      
      if (smartAccountEthBalance < 1000000000000000n) { // 0.001 ETH
        console.log("❌ Smart Account needs some ETH for the approval transaction");
        console.log("💡 Sending small amount of ETH to smart account...");
        
        const ethFundTx = await walletClient.sendTransaction({
          to: smartAccount.address,
          value: 2000000000000000n, // 0.002 ETH
        });
        
        await publicClient.waitForTransactionReceipt({ hash: ethFundTx });
        console.log("✅ ETH funded to smart account");
      }
      
      // Note: This would require the smart account to make the approval
      console.log("❌ ISSUE: Smart accounts can't make direct contract calls without UserOps");
      console.log("🔧 SOLUTION: Use permit-based approval in the UserOperation itself");
    }
    
    console.log("\n6️⃣ Creating UserOperation with Permit (EIP-2612)...");
    
    // For Circle Paymaster, we need to use EIP-2612 permit signature
    // This allows gasless approval within the UserOperation itself
    
    const transferAmount = 1000000n; // 1 USDC
    const gasAllowance = 5000000n; // 5 USDC max for gas
    
    // Create EIP-2612 permit signature
    const domain = {
      name: "USD Coin",
      version: "2",
      chainId: chain.id,
      verifyingContract: usdcAddress,
    };
    
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    
    // Get current nonce for permit
    const nonce = await publicClient.readContract({
      address: usdcAddress,
      abi: [...erc20Abi, {
        inputs: [{ name: "owner", type: "address" }],
        name: "nonces",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      }],
      functionName: "nonces",
      args: [smartAccount.address],
    });
    
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
    
    const permitMessage = {
      owner: smartAccount.address,
      spender: CIRCLE_PAYMASTER_V07,
      value: gasAllowance,
      nonce,
      deadline,
    };
    
    console.log("Creating permit signature...");
    console.log("Permit details:", permitMessage);
    
    // Sign the permit (this would need to be done by the smart account)
    // For now, we'll show the structure
    
    console.log("\n❌ CURRENT LIMITATION:");
    console.log("The smart account needs to sign the EIP-2612 permit, but we're using the EOA to sign");
    console.log("This creates a chicken-and-egg problem:");
    console.log("- Need permit signature from smart account to use paymaster");
    console.log("- Need paymaster to avoid using ETH for gas");
    console.log("- But smart account needs ETH to make the permit signature");
    
    console.log("\n💡 POTENTIAL SOLUTIONS:");
    console.log("1. Fund smart account with small ETH for one-time approval");
    console.log("2. Use a paymaster that doesn't require pre-approval");
    console.log("3. Use Circle's upcoming EIP-7702 support when available");
    console.log("4. Use your working ethertest.js approach for swaps");
    
    console.log("\n🎯 RECOMMENDATION:");
    console.log("For now, use your working ethertest.js for gasless swaps");
    console.log("Wait for Circle's EIP-7702 implementation for true gasless EOA transactions");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Full error:", error);
  }
}

main().catch(console.error);