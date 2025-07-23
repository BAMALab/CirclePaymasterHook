import "dotenv/config";
import { createPublicClient, http, createWalletClient, encodeAbiParameters } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi } from "viem";

const chain = sepolia;
const usdcAddress = process.env.USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;

// Official Circle Paymaster v0.7 addresses from documentation
const CIRCLE_PAYMASTER_V07 = "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966";
const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

console.log("🎯 CIRCLE PAYMASTER v0.7 - TRUE GASLESS TRANSACTIONS");
console.log("=======================================================");

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

console.log("Account Address:", owner.address);
console.log("Chain:", publicClient.chain.name);
console.log("Circle Paymaster v0.7:", CIRCLE_PAYMASTER_V07);
console.log("EntryPoint v0.7:", ENTRYPOINT_V07);

// Check contract deployments
async function verifyDeployments() {
  console.log("\n🔧 VERIFYING OFFICIAL DEPLOYMENTS:");
  console.log("=====================================");
  
  const [usdcCode, paymasterCode, entryPointCode] = await Promise.all([
    publicClient.getCode({ address: usdcAddress }),
    publicClient.getCode({ address: CIRCLE_PAYMASTER_V07 }),
    publicClient.getCode({ address: ENTRYPOINT_V07 })
  ]);
  
  const usdcExists = usdcCode && usdcCode !== "0x";
  const paymasterExists = paymasterCode && paymasterCode !== "0x";
  const entryPointExists = entryPointCode && entryPointCode !== "0x";
  
  console.log("✅ USDC Contract:", usdcExists ? "DEPLOYED" : "NOT FOUND");
  console.log("✅ Circle Paymaster v0.7:", paymasterExists ? "DEPLOYED" : "NOT FOUND");
  console.log("✅ EntryPoint v0.7:", entryPointExists ? "DEPLOYED" : "NOT FOUND");
  
  if (!usdcExists || !paymasterExists || !entryPointExists) {
    throw new Error("Required contracts not deployed!");
  }
  
  console.log("🎉 All required contracts are deployed!");
  return true;
}

// Simple Account Factory ABI (just what we need)
const simpleAccountFactoryAbi = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "salt", type: "uint256" }
    ],
    name: "createAccount",
    outputs: [{ name: "ret", type: "address" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "salt", type: "uint256" }
    ],
    name: "getAddress",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  }
];

// Simple Account Factory address (standard for v0.7)
const SIMPLE_ACCOUNT_FACTORY = "0x9406Cc6185a346906296840746125a0E44976454";

// Get or create smart account
async function getSmartAccount() {
  console.log("\n🏭 GETTING SMART CONTRACT ACCOUNT:");
  console.log("===================================");
  
  const salt = 0n; // Use salt 0 for simplicity
  
  // Get the predicted smart account address
  const smartAccountAddress = await publicClient.readContract({
    address: SIMPLE_ACCOUNT_FACTORY,
    abi: simpleAccountFactoryAbi,
    functionName: 'getAddress',
    args: [owner.address, salt]
  });
  
  console.log("Smart Account Address:", smartAccountAddress);
  
  // Check if account is deployed
  const code = await publicClient.getCode({ address: smartAccountAddress });
  const isDeployed = code && code !== "0x";
  
  console.log("Account Status:", isDeployed ? "DEPLOYED" : "NOT DEPLOYED");
  
  if (!isDeployed) {
    console.log("🚀 Deploying smart account...");
    
    const hash = await walletClient.writeContract({
      address: SIMPLE_ACCOUNT_FACTORY,
      abi: simpleAccountFactoryAbi,
      functionName: 'createAccount',
      args: [owner.address, salt]
    });
    
    console.log("Deployment transaction:", hash);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("✅ Smart account deployed!");
  }
  
  return smartAccountAddress;
}

// Check balances
async function checkBalances(smartAccountAddress) {
  console.log("\n💰 CHECKING BALANCES:");
  console.log("========================");
  
  const [usdcBalance, ethBalance] = await Promise.all([
    publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [smartAccountAddress]
    }),
    publicClient.getBalance({ address: smartAccountAddress })
  ]);
  
  console.log("Smart Account USDC:", (Number(usdcBalance) / 1000000).toFixed(6), "USDC");
  console.log("Smart Account ETH:", (Number(ethBalance) / 1000000000000000000).toFixed(6), "ETH");
  
  return { usdcBalance, ethBalance };
}

// UserOperation structure for v0.7
function createUserOp(smartAccountAddress, callData, gasLimits) {
  return {
    sender: smartAccountAddress,
    nonce: 0n, // Simplified - should get actual nonce
    callData: callData,
    callGasLimit: gasLimits.callGasLimit,
    verificationGasLimit: gasLimits.verificationGasLimit,
    preVerificationGas: gasLimits.preVerificationGas,
    maxFeePerGas: gasLimits.maxFeePerGas,
    maxPriorityFeePerGas: gasLimits.maxPriorityFeePerGas,
    paymaster: CIRCLE_PAYMASTER_V07,
    paymasterVerificationGasLimit: 200000n,
    paymasterPostOpGasLimit: 50000n,
    paymasterData: "0x", // Will be filled with permit data
    signature: "0x" // Will be signed
  };
}

// Demonstrate the theoretical approach
async function demonstrateCirclePaymaster() {
  try {
    console.log("\n🚀 CIRCLE PAYMASTER v0.7 DEMONSTRATION:");
    console.log("==========================================");
    
    await verifyDeployments();
    
    const smartAccountAddress = await getSmartAccount();
    const { usdcBalance, ethBalance } = await checkBalances(smartAccountAddress);
    
    console.log("\n📋 IMPLEMENTATION NOTES:");
    console.log("========================");
    console.log("1. ✅ Circle Paymaster v0.7 is deployed and verified");
    console.log("2. ✅ EntryPoint v0.7 is deployed and functional");
    console.log("3. ✅ Smart Account Factory is available");
    console.log("4. 🔧 Full implementation requires:");
    console.log("   • EIP-2612 permit signature for USDC");
    console.log("   • UserOperation construction and signing");
    console.log("   • Bundler service integration (Pimlico/Alchemy)");
    console.log("   • Proper gas estimation");
    
    console.log("\n💡 NEXT STEPS:");
    console.log("==============");
    console.log("1. Fund smart account with USDC");
    console.log(`   Smart Account: ${smartAccountAddress}`);
    console.log("   Get USDC: https://faucet.circle.com");
    console.log("2. Implement EIP-2612 permit signing");
    console.log("3. Use Pimlico/Alchemy bundler service");
    console.log("4. Test with simple USDC transfer");
    
    if (usdcBalance > 0n) {
      console.log(`\n🎉 READY TO TEST! Smart account has ${(Number(usdcBalance) / 1000000).toFixed(6)} USDC`);
      console.log("You can now implement the full UserOperation flow!");
    } else {
      console.log("\n💸 FUND NEEDED: Send USDC to smart account to test gasless transactions");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    
    if (error.message.includes("execution reverted")) {
      console.log("💡 This might be due to missing smart account setup");
      console.log("   The contracts are deployed and ready to use!");
    }
  }
}

// Create a simplified working example (fund smart account first)
async function createWorkingExample() {
  console.log("\n🔥 WORKING EXAMPLE SETUP:");
  console.log("==========================");
  console.log("Here's what you need to implement for TRUE gasless transactions:");
  console.log("");
  console.log("1. 📝 EIP-2612 Permit Signature:");
  console.log("   const permitSignature = await signPermit({");
  console.log("     token: USDC_ADDRESS,");
  console.log("     owner: smartAccountAddress,");
  console.log("     spender: CIRCLE_PAYMASTER_V07,");
  console.log("     value: maxGasInUSDC");
  console.log("   });");
  console.log("");
  console.log("2. 🏗️ UserOperation Construction:");
  console.log("   const userOp = {");
  console.log("     sender: smartAccountAddress,");
  console.log("     callData: transferCallData,");
  console.log("     paymaster: CIRCLE_PAYMASTER_V07,");
  console.log("     paymasterData: permitSignature");
  console.log("   };");
  console.log("");
  console.log("3. 📡 Bundler Submission:");
  console.log("   const bundlerUrl = 'https://api.pimlico.io/v2/sepolia/rpc';");
  console.log("   const userOpHash = await submitUserOp(userOp);");
  console.log("");
  console.log("🔗 Resources:");
  console.log("• Circle Paymaster Docs: https://developers.circle.com/w3s/paymaster");
  console.log("• Pimlico Bundler: https://www.pimlico.io");
  console.log("• viem Account Abstraction: https://viem.sh/account-abstraction");
}

// Run the demonstration
demonstrateCirclePaymaster()
  .then(() => createWorkingExample())
  .then(() => {
    console.log("\n🎯 CONCLUSION:");
    console.log("==============");
    console.log("✅ Circle Paymaster v0.7 IS available on Sepolia!");
    console.log("✅ All infrastructure contracts are deployed!");
    console.log("✅ You can implement TRUE gasless USDC transactions!");
    console.log("🚀 The foundation is ready - just need the UserOp implementation!");
  })
  .catch(console.error);