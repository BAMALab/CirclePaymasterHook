import { ethers } from "ethers";
import { PermitSingle, getPermitData } from "@uniswap/permit2-sdk";
import { readFile } from "fs/promises";

// --- CONFIG ---
const permit2Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const routerAddress = "0x00000000000044a361Ae3cAc094c9D1b14Eece97";
const paymasterAddress = "0x194CC08EFeD09BE41E94b9Bb4c5Aa265662B428e";
const chainId = 11155111; // Sepolia
const amount = ethers.parseUnits("1.0", 6); // 1 USDC (6 decimals)
const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
const nonce = 0; // For demo, use 0. In production, fetch from Permit2 contract.

// User (no ETH required)
const userPrivateKey = process.env.USER_PK || "<USER_PRIVATE_KEY>";
const user = new ethers.Wallet(userPrivateKey);

// Relayer (has ETH)
const relayerPrivateKey = process.env.RELAYER_PK || "<RELAYER_PRIVATE_KEY>";
const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/709bdd438a58422b891043c58e636a64");
const relayer = new ethers.Wallet(relayerPrivateKey, provider);

const permit2Abi = [
  "function permit(address owner, (address token,uint160 amount,uint48 expiration,uint48 nonce) details, address spender, uint256 sigDeadline, bytes signature)"
];
const permit2 = new ethers.Contract(permit2Address, permit2Abi, relayer);

async function signAndRelayPermit(spender, spenderLabel) {
  // 1. Build the permit data
  const permit = {
    details: {
      token: usdcAddress,
      amount: amount,
      expiration: deadline,
      nonce: nonce,
    },
    spender: spender,
    sigDeadline: deadline,
  };

  // 2. Get the EIP-712 data to sign
  const permitData = getPermitData(permit, permit2Address, chainId);

  // 3. User signs the permit (off-chain, no ETH needed)
  const signature = await user.signTypedData(
    permitData.domain,
    { PermitSingle: permitData.types.PermitSingle },
    permitData.message
  );

  console.log(`\nSigned Permit2 for ${spenderLabel}:`);
  console.log("Signature:", signature);

  // 4. Relayer submits the permit on-chain
  const tx = await permit2.permit(
    user.address,
    permit.details,
    permit.spender,
    permit.sigDeadline,
    signature
  );
  await tx.wait();
  console.log(`Permit2 approval for ${spenderLabel} submitted! Tx:`, tx.hash);
}

async function main() {
  console.log("\n=== Permit2 Gasless Approval Script ===");
  console.log("User:", user.address);
  console.log("Relayer:", relayer.address);
  console.log("USDC:", usdcAddress);
  console.log("Router:", routerAddress);
  console.log("Paymaster:", paymasterAddress);

  // Approve for Router
  await signAndRelayPermit(routerAddress, "Uniswap V4 Router");

  // Approve for Paymaster
  await signAndRelayPermit(paymasterAddress, "Circle Paymaster Integration");

  console.log("\n✅ Permit2 gasless approvals complete! Both router and paymaster can now spend user's USDC.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}); 