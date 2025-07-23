import "dotenv/config";
import {
  createPublicClient,
  http,
  getContract,
  encodePacked,
  encodeFunctionData,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  createBundlerClient,
  toSimple7702SmartAccount,
} from "viem/account-abstraction";
import { signPermit } from "./permit.js";
import { erc20Abi } from "viem";

// --- ENV CONFIG ---
const chain = sepolia;
const usdcAddress = process.env.USDC_ADDRESS; // e.g. 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
// Set the correct Circle Paymaster v0.8 address for Sepolia
const paymasterAddress = "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966";
const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
const recipientAddress = process.env.RECIPIENT_ADDRESS;
const routerAddress =
  process.env.UNISWAP_ROUTER_ADDRESS ||
  "0x00000000000044a361Ae3cAc094c9D1b14Eece97";

// --- Uniswap V4 router ABI fragment for swapExactTokensForTokens ---
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

// --- Swap parameters (from ethertest.js) ---
const amountOutMin = 0n;
const zeroForOne = true;
const fee = 5000;
const tickSpacing = 100;
const hooks = "0xc9e902b5047433935C8f6B173fC936Fd696C00c0";
const poolKey = [
  usdcAddress, // currency0
  "0x90954dcFB08C84e1ebA306f59FAD660b3A7B5808", // currency1 (WETH)
  fee,
  tickSpacing,
  hooks,
];
const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
const hookData = encodePacked(["bool", "address"], [true, recipientAddress]);

// --- Approval mode paymasterAndData for Circle Paymaster ---
const paymasterAndData =
  paymasterAddress.toLowerCase().replace(/^0x/, "").padStart(40, "0") +
  usdcAddress.toLowerCase().replace(/^0x/, "").padStart(40, "0");

// --- Set up viem client and smart account ---
const client = createPublicClient({ chain, transport: http() });
const owner = privateKeyToAccount(ownerPrivateKey);
const account = await toSimple7702SmartAccount({ client, owner });

// --- Check USDC balance ---
const usdc = getContract({ client, address: usdcAddress, abi: erc20Abi });

// --- Now check USDC balance, allowance, and submit gasless approval UserOp if needed ---
const usdcBalance = await usdc.read.balanceOf([account.address]);
console.log("Smart account USDC balance:", usdcBalance.toString());

// Use the maximum available balance minus a small buffer for the swap
const buffer = 10000n; // leave a small buffer to avoid dust issues
let amountIn = usdcBalance > buffer ? usdcBalance - buffer : 0n;
if (amountIn <= 0n) {
  console.log(
    `Smart account has no USDC to swap. Fund ${account.address} with USDC on Sepolia, then run this again.`
  );
  process.exit();
}
console.log("Amount to swap:", amountIn.toString());

if (usdcBalance < amountIn) {
  console.log(
    `Fund ${account.address} with USDC on Sepolia, then run this again.`
  );
  process.exit();
}

// --- Set up the bundler client (Pimlico public endpoint for Sepolia) ---
const bundlerClient = createBundlerClient({
  account,
  client,
  // Pass paymasterAndData as a top-level property for all UserOps
  paymasterAndData: "0x" + paymasterAndData,
  userOperation: {
    estimateFeesPerGas: async ({ bundlerClient }) => {
      const { standard: fees } = await bundlerClient.request({
        method: "pimlico_getUserOperationGasPrice",
      });
      return {
        maxFeePerGas: BigInt(fees.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(fees.maxPriorityFeePerGas),
      };
    },
  },
  transport: http(`https://public.pimlico.io/v2/${chain.id}/rpc`),
});

// --- Sign authorization for 7702 account ---
let authorization = await owner.signAuthorization({
  chainId: chain.id,
  nonce: await client.getTransactionCount({ address: owner.address }),
  contractAddress: account.authorization.address,
});

const usdcAllowance = await usdc.read.allowance([
  account.address,
  paymasterAddress,
]);
if (usdcAllowance < amountIn) {
  console.log(
    "USDC allowance for paymaster is insufficient. Submitting gasless approval UserOperation..."
  );
  const approveCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [paymasterAddress, amountIn],
  });
  const approveHash = await bundlerClient.sendUserOperation({
    account,
    calls: [
      {
        to: usdcAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [paymasterAddress, amountIn],
        value: 0n,
      },
    ],
    authorization,
  });
  console.log("Approval UserOperation hash:", approveHash);
  const approveReceipt = await bundlerClient.waitForUserOperationReceipt({
    hash: approveHash,
  });
  console.log(
    "Approval UserOperation confirmed! Transaction hash:",
    approveReceipt.receipt.transactionHash
  );
  // --- Refresh authorization for swap UserOp ---
  const swapNonce = await client.getTransactionCount({
    address: owner.address,
  });
  authorization = await owner.signAuthorization({
    chainId: chain.id,
    nonce: swapNonce,
    contractAddress: account.authorization.address,
  });
}

// --- Submit the user operation (Uniswap swap) ---
const hash = await bundlerClient.sendUserOperation({
  account,
  calls: [
    {
      to: routerAddress,
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
      value: 0n,
    },
  ],
  authorization,
});
console.log("UserOperation hash", hash);

const receipt = await bundlerClient.waitForUserOperationReceipt({ hash });
console.log("Transaction hash", receipt.receipt.transactionHash);

// --- Print final balances ---
const usdcBalanceAfter = await usdc.read.balanceOf([account.address]);
console.log("Smart account USDC balance after:", usdcBalanceAfter.toString());

process.exit();
