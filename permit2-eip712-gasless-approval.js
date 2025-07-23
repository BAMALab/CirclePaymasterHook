import { ethers } from "ethers";

// --- CONFIG ---
const permit2Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const routerAddress = "0x00000000000044a361Ae3cAc094c9D1b14Eece97";
const paymasterAddress = "0x194CC08EFeD09BE41E94b9Bb4c5Aa265662B428e";
const chainId = 11155111; // Sepolia
const amount = ethers.parseUnits("1.0", 6); // 1 USDC (6 decimals)
const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

// User (no ETH required for permit, but ETH required for first approve)
const userPrivateKey =
  process.env.USER_PK ||
  "0x1cdc0890efa3dc7f5d72a128d57eb1ead4c0aac76e37523d9d1ffb2755ae23ab";
const userProvider = new ethers.JsonRpcProvider(
  "https://sepolia.infura.io/v3/709bdd438a58422b891043c58e636a64"
);
const user = new ethers.Wallet(userPrivateKey, userProvider);

// Relayer (has ETH)
const relayerPrivateKey =
  process.env.RELAYER_PK ||
  "0x3de4897ccd7d584ca6cc0922795d24da80bca084bbb9bc3e8645c5a6a190eb95";
  
let rpcUrl = "https://sepolia.infura.io/v3/709bdd438a58422b891043c58e636a64";
if (process.env.SEPOLIA_RPC) {
  rpcUrl = process.env.SEPOLIA_RPC;
}
const provider = new ethers.JsonRpcProvider(rpcUrl);
const relayer = new ethers.Wallet(relayerPrivateKey, provider);

const permit2Abi = [
  "function permit(address owner, (address token,uint160 amount,uint48 expiration,uint48 nonce) details, address spender, uint256 sigDeadline, bytes signature)",
  "function nonceBitmap(address,uint256) view returns (uint256)",
];
const permit2 = new ethers.Contract(permit2Address, permit2Abi, relayer);
const permit2Read = new ethers.Contract(permit2Address, permit2Abi, provider);

const erc20Abi = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];
const usdc = new ethers.Contract(usdcAddress, erc20Abi, provider);
const usdcUser = new ethers.Contract(usdcAddress, erc20Abi, user);

const domain = {
  name: "Permit2",
  chainId: chainId,
  verifyingContract: permit2Address,
};

const types = {
  PermitSingle: [
    { name: "details", type: "PermitDetails" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
};

// Find the first unused nonce (lowest unset bit in the bitmap)
async function getPermit2Nonce(owner, token) {
  const wordPos = 0;
  const bitmap = await permit2Read.nonceBitmap(owner, wordPos);
  for (let i = 0; i < 256; i++) {
    if (((bitmap >> BigInt(i)) & 1n) === 0n) {
      return i;
    }
  }
  throw new Error("No available nonce in first bitmap word");
}

async function checkAndAutoApproveERC20(owner) {
  const allowance = await usdc.allowance(owner, permit2Address);
  if (allowance < amount) {
    // Check if user has ETH for gas
    const ethBalance = await userProvider.getBalance(owner);
    if (ethBalance < ethers.parseEther("0.0001")) {
      console.log(
        "\n❗ Permit2 cannot be used until the user has approved Permit2 to spend their USDC."
      );
      console.log(
        "   This is a one-time ERC-20 approve transaction and requires ETH for gas."
      );
      console.log(
        "   Please fund the user account with a small amount of Sepolia ETH and re-run this script."
      );
      return false;
    }
    // Auto-approve Permit2 for USDC
    console.log(
      "\n🔄 Sending one-time ERC-20 approve transaction for Permit2 from user account..."
    );
    const tx = await usdcUser.approve(permit2Address, amount);
    console.log("   Waiting for approval tx:", tx.hash);
    await tx.wait();
    console.log("✅ Permit2 approved to spend user's USDC!");
    return true;
  }
  return true;
}

async function signAndRelayPermit(spender, spenderLabel) {
  // 1. Fetch the correct nonce
  const nonce = await getPermit2Nonce(user.address, usdcAddress);

  // 2. Build the permit message
  const message = {
    details: {
      token: usdcAddress,
      amount: amount.toString(),
      expiration: deadline,
      nonce: nonce,
    },
    spender: spender,
    sigDeadline: deadline,
  };

  // 3. User signs the permit (off-chain, no ETH needed)
  const signature = await user.signTypedData(domain, types, message);

  console.log(`\nSigned Permit2 for ${spenderLabel}:`);
  console.log("Nonce:", nonce);
  console.log("Signature:", signature);

  // 4. Relayer submits the permit on-chain
  const tx = await permit2.permit(
    user.address,
    message.details,
    message.spender,
    message.sigDeadline,
    signature
  );
  await tx.wait();
  console.log(`Permit2 approval for ${spenderLabel} submitted! Tx:`, tx.hash);
}

async function main() {
  console.log("\n=== Minimal Permit2 EIP-712 Gasless Approval Script ===");
  console.log("User:", user.address);
  console.log("Relayer:", relayer.address);
  console.log("USDC:", usdcAddress);
  console.log("Router:", routerAddress);
  console.log("Paymaster:", paymasterAddress);

  // Check provider connectivity
  try {
    await provider.getBlockNumber();
  } catch (e) {
    console.error("\n❌ Could not connect to Sepolia RPC endpoint:", rpcUrl);
    console.error(
      "   Please check your internet connection or try a different RPC endpoint."
    );
    process.exit(1);
  }

  // Check if ERC-20 approve is done, or auto-approve if possible
  const canProceed = await checkAndAutoApproveERC20(user.address);
  if (!canProceed) return;

  // Approve for Router
  await signAndRelayPermit(routerAddress, "Uniswap V4 Router");

  // Approve for Paymaster
  await signAndRelayPermit(paymasterAddress, "Circle Paymaster Integration");

  console.log(
    "\n✅ Permit2 gasless approvals complete! Both router and paymaster can now spend user's USDC."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
