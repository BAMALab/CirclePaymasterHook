import "dotenv/config";
import { createPublicClient, http, createWalletClient, encodeAbiParameters, encodeFunctionData } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createBundlerClient, toSimple7702SmartAccount } from "viem/account-abstraction";
import { erc20Abi } from "viem";

const chain = sepolia;
const usdcAddress = process.env.USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
const recipientAddress = process.env.RECIPIENT_ADDRESS;

// Official Circle Paymaster v0.7 addresses from Circle documentation
const CIRCLE_PAYMASTER_V07 = "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966";
const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

console.log("🎯 CIRCLE PAYMASTER v0.7 - TRUE GASLESS USDC TRANSFER");
console.log("=====================================================");

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

// Note: You'll need to get a bundler API key from Pimlico, Alchemy, or similar
// For now, this will show the error and what you need to do
const bundlerApiKey = process.env.BUNDLER_API_KEY;

if (!bundlerApiKey) {
  console.log("\n🔧 SETUP REQUIRED:");
  console.log("1. Get a bundler API key from Pimlico: https://pimlico.io");
  console.log("2. Or use Alchemy: https://alchemy.com");
  console.log("3. Add BUNDLER_API_KEY=your_key_here to your .env file");
  console.log("4. The bundler is required for ERC-4337 UserOperations");
  process.exit(1);
}

const bundlerClient = createBundlerClient({
  chain,
  transport: http(`https://api.pimlico.io/v2/sepolia/rpc?apikey=${bundlerApiKey}`),
  entryPointAddress: ENTRYPOINT_V07,
});

async function main() {
  try {
    console.log("\n1️⃣ Setting up Smart Account...");
    
    // Create simple smart account
    const smartAccount = await toSimple7702SmartAccount({
      client: publicClient,
      owner,
      entryPointAddress: ENTRYPOINT_V07,
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
    
    // Transfer some USDC to smart account if needed
    if (smartAccountUsdcBalance < 1000000n) { // Less than 1 USDC
      console.log("\n3️⃣ Funding Smart Account with USDC...");
      
      const fundTx = await walletClient.writeContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [smartAccount.address, 5000000n], // 5 USDC
      });
      
      console.log("Funding transaction:", fundTx);
      
      // Wait for funding to complete
      await publicClient.waitForTransactionReceipt({ hash: fundTx });
      
      const newSmartAccountUsdcBalance = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [smartAccount.address],
      });
      
      console.log(`✅ Smart Account USDC after funding: ${newSmartAccountUsdcBalance} units`);
    }
    
    console.log("\n4️⃣ Preparing Gasless USDC Transfer UserOperation...");
    
    // Prepare the USDC transfer call data
    const transferAmount = 1000000n; // 1 USDC
    const transferCallData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipientAddress, transferAmount],
    });
    
    // Prepare paymaster data for Circle Paymaster v0.7
    // The paymaster needs to know which token to charge (USDC)
    const paymasterData = encodeAbiParameters(
      [{ type: "address", name: "token" }],
      [usdcAddress]
    );
    
    console.log("Transfer amount:", transferAmount.toString(), "USDC units");
    console.log("To:", recipientAddress);
    console.log("Paymaster:", CIRCLE_PAYMASTER_V07);
    console.log("Token for gas:", usdcAddress);
    
    // Create UserOperation
    const userOperation = await bundlerClient.prepareUserOperation({
      account: smartAccount,
      calls: [{
        to: usdcAddress,
        data: transferCallData,
      }],
      paymaster: CIRCLE_PAYMASTER_V07,
      paymasterData,
    });
    
    console.log("\n5️⃣ Submitting UserOperation...");
    console.log("UserOperation prepared:", {
      sender: userOperation.sender,
      nonce: userOperation.nonce,
      paymaster: userOperation.paymaster,
    });
    
    // Submit the UserOperation
    const userOpHash = await bundlerClient.sendUserOperation(userOperation);
    console.log("✅ UserOperation submitted:", userOpHash);
    
    // Wait for the UserOperation to be mined
    console.log("\n6️⃣ Waiting for UserOperation to be mined...");
    const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
    
    console.log("✅ UserOperation mined!");
    console.log("Transaction hash:", receipt.receipt.transactionHash);
    console.log("Block number:", receipt.receipt.blockNumber);
    console.log("Gas used:", receipt.receipt.gasUsed);
    
    // Check final balances
    console.log("\n7️⃣ Checking Final Balances...");
    
    const finalOwnerEthBalance = await publicClient.getBalance({ address: owner.address });
    const finalSmartAccountEthBalance = await publicClient.getBalance({ address: smartAccount.address });
    const finalSmartAccountUsdcBalance = await publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [smartAccount.address],
    });
    
    const finalRecipientUsdcBalance = await publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [recipientAddress],
    });
    
    console.log(`Final EOA ETH: ${finalOwnerEthBalance} wei`);
    console.log(`Final Smart Account ETH: ${finalSmartAccountEthBalance} wei`);
    console.log(`Final Smart Account USDC: ${finalSmartAccountUsdcBalance} units`);
    console.log(`Final Recipient USDC: ${finalRecipientUsdcBalance} units`);
    
    // Calculate changes
    console.log("\n📊 BALANCE CHANGES:");
    console.log(`EOA ETH change: ${finalOwnerEthBalance - ownerEthBalance} wei`);
    console.log(`Smart Account ETH change: ${finalSmartAccountEthBalance - smartAccountEthBalance} wei`);
    console.log(`Smart Account USDC change: ${finalSmartAccountUsdcBalance - smartAccountUsdcBalance} units`);
    
    if (finalOwnerEthBalance === ownerEthBalance && finalSmartAccountEthBalance === smartAccountEthBalance) {
      console.log("🎉 SUCCESS: NO ETH WAS USED FOR GAS! Gas was paid in USDC!");
    } else {
      console.log("⚠️  ETH was still used for gas. Need to investigate...");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Full error:", error);
    
    if (error.message.includes("apikey")) {
      console.log("\n🔧 SETUP REQUIRED:");
      console.log("1. Get a bundler API key from Pimlico: https://pimlico.io");
      console.log("2. Or use Alchemy: https://alchemy.com");
      console.log("3. Replace 'YOUR_API_KEY_HERE' in the bundler URL");
      console.log("4. The bundler is required for ERC-4337 UserOperations");
    }
  }
}

main().catch(console.error);
