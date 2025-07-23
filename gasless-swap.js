import "dotenv/config";
import {
  createPublicClient,
  http,
  getContract,
  encodePacked,
  hexToBigInt,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  createBundlerClient,
  toSimple7702SmartAccount,
} from "viem/account-abstraction";
import { maxUint256, erc20Abi, parseErc6492Signature } from "viem";

// Configuration
const chain = sepolia;
const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
const paymasterAddress = "0x194CC08EFeD09BE41E94b9Bb4c5Aa265662B428e"; // Circle Paymaster Integration (your deployed contract)
const swapRouterAddress = "0x00000000000044a361Ae3cAc094c9D1b14Eece97"; // Uniswap V4 Router

// User configuration
const ownerPrivateKey =
  "0x1cdc0890efa3dc7f5d72a128d57eb1ead4c0aac76e37523d9d1ffb2755ae23ab"; // Address with USDC but no ETH
const recipientAddress = "0x9dBa18e9b96b905919cC828C399d313EfD55D800"; // Same as account address

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
  [true, recipientAddress] // gasless mode, user address
);

// Set up clients and account
const client = createPublicClient({ chain, transport: http() });
const owner = privateKeyToAccount(ownerPrivateKey);
const account = await toSimple7702SmartAccount({ client, owner });

console.log("🔧 Setting up gasless swap with Circle Paymaster v0.8");
console.log("Account address:", account.address);
console.log("Chain:", client.chain.name);

// Check USDC balance
const usdc = getContract({ client, address: usdcAddress, abi: erc20Abi });
const usdcBalance = await usdc.read.balanceOf([account.address]);
console.log("USDC balance:", usdcBalance.toString());

if (usdcBalance < amountIn) {
  console.error("❌ Insufficient USDC balance for swap");
  console.error(`Need: ${amountIn}, Have: ${usdcBalance}`);
  process.exit(1);
}

// EIP-2612 Permit implementation for gasless approvals
async function eip2612Permit({
  token,
  chain,
  ownerAddress,
  spenderAddress,
  value,
}) {
  return {
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    domain: {
      name: await token.read.name(),
      version: await token.read.version(),
      chainId: chain.id,
      verifyingContract: token.address,
    },
    message: {
      owner: ownerAddress,
      spender: spenderAddress,
      value,
      nonce: await token.read.nonces([ownerAddress]),
      deadline: maxUint256,
    },
  };
}

const eip2612Abi = [
  ...erc20Abi,
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    stateMutability: "view",
    type: "function",
    name: "nonces",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

async function signPermit({
  tokenAddress,
  client,
  account,
  spenderAddress,
  permitAmount,
}) {
  const token = getContract({
    client,
    address: tokenAddress,
    abi: eip2612Abi,
  });

  const permitData = await eip2612Permit({
    token,
    chain: client.chain,
    ownerAddress: account.address,
    spenderAddress,
    value: permitAmount,
  });

  const wrappedPermitSignature = await account.signTypedData(permitData);
  const { signature } = parseErc6492Signature(wrappedPermitSignature);

  return signature;
}

// Circle Paymaster configuration
const paymaster = {
  async getPaymasterData(parameters) {
    const permitAmount = 10000000n; // 10 USDC for gas fees
    const permitSignature = await signPermit({
      tokenAddress: usdcAddress,
      account,
      client,
      spenderAddress: paymasterAddress,
      permitAmount: permitAmount,
    });

    const paymasterData = encodePacked(
      ["uint8", "address", "uint256", "bytes"],
      [0, usdcAddress, permitAmount, permitSignature]
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

// Uniswap V4 Router ABI (minimal for swapExactTokensForTokens)
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

// Execute gasless swap
async function executeGaslessSwap() {
  try {
    console.log("\n🚀 Executing gasless swap...");
    console.log("Amount in:", amountIn.toString(), "USDC");
    console.log("Pool key:", poolKey);
    console.log("Hook data:", hookData);

    // Sign authorization for 7702 account
    const authorization = await owner.signAuthorization({
      chainId: chain.id,
      nonce: await client.getTransactionCount({ address: owner.address }),
      contractAddress: account.authorization.address,
    });

    // Submit user operation for the swap
    const hash = await bundlerClient.sendUserOperation({
      account,
      calls: [
        {
          to: swapRouterAddress,
          abi: routerAbi,
          functionName: "swapExactTokensForTokens",
          args: [
            amountIn,
            amountOutMin,
            zeroForOne,
            poolKey,
            hookData,
            recipientAddress,
            deadline,
          ],
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
  } catch (error) {
    console.error("❌ Gasless swap failed:", error.message);
    if (error.details) {
      console.error("Error details:", error.details);
    }
  }
}

// Run the gasless swap
executeGaslessSwap()
  .then(() => {
    console.log("\n🎉 Gasless swap completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
 