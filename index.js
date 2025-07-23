import "dotenv/config";
import { createPublicClient, http, getContract, encodePacked, hexToBigInt } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createBundlerClient, toSimple7702SmartAccount } from "viem/account-abstraction";
import { erc20Abi } from "viem";
import { signPermit } from "./permit.js";

const chain = sepolia;
const usdcAddress = process.env.USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
const paymasterAddress = process.env.PAYMASTER_V08_ADDRESS || "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966";
const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
const recipientAddress = process.env.RECIPIENT_ADDRESS;

// Set up the public client
const client = createPublicClient({ 
  chain, 
  transport: http() 
});
const owner = privateKeyToAccount(ownerPrivateKey);
const account = await toSimple7702SmartAccount({ client, owner });

console.log("Smart account address:", account.address);
console.log("Chain:", client.chain.name);

// Configure the Circle Paymaster
const paymaster = {
  async getPaymasterData(parameters) {
    const permitAmount = 10000000n;
    const permitSignature = await signPermit({
      tokenAddress: usdcAddress,
      account,
      client,
      spenderAddress: paymasterAddress,
      permitAmount: permitAmount,
    });

    const paymasterData = encodePacked(
      ["uint8", "address", "uint256", "bytes"],
      [0, usdcAddress, permitAmount, permitSignature],
    );

    return {
      paymaster: paymasterAddress,
      paymasterData,
      paymasterVerificationGasLimit: 200000n,
      paymasterPostOpGasLimit: 15000n,
      isFinal: true,
    };
  },
};



// Check USDC balance
const usdc = getContract({ client, address: usdcAddress, abi: erc20Abi });
const usdcBalance = await usdc.read.balanceOf([account.address]);
console.log("USDC balance:", usdcBalance.toString());

if (usdcBalance < 10000n) {
  console.log(
    `Fund ${account.address} with USDC on ${client.chain.name} using https://faucet.circle.com, then run this again.`,
  );
  process.exit(0);
}

// Set up the bundler client
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

// Sign authorization for 7702 account
const authorization = await owner.signAuthorization({
  chainId: chain.id,
  nonce: await client.getTransactionCount({ address: owner.address }),
  contractAddress: account.authorization.address,
});

// Execute a simple USDC transfer
async function executeGaslessTransfer() {
  try {
    console.log("\n🚀 Executing gasless USDC transfer with Circle Paymaster...");
    console.log("Transferring 10000 USDC to", recipientAddress);
    
    const hash = await bundlerClient.sendUserOperation({
      account,
      calls: [
        {
          to: usdc.address,
          abi: usdc.abi,
          functionName: "transfer",
          args: [recipientAddress, 10000n],
        },
      ],
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
    const finalBalance = await usdc.read.balanceOf([account.address]);
    console.log("Final USDC balance:", finalBalance.toString());
    console.log("Gas fees were paid in USDC via the Circle Paymaster!");
  } catch (error) {
    console.error("❌ Gasless transfer failed:", error.message);
    if (error.details) {
      console.error("Error details:", error.details);
    }
    console.error("Full error:", error);
  }
}

// Run the gasless transfer
executeGaslessTransfer()
  .then(() => {
    console.log("\n🎉 Account Abstraction gasless transfer completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
