import { ethers } from "ethers";

// --- CONFIG ---
const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const routerAddress = "0x00000000000044a361Ae3cAc094c9D1b14Eece97";
const paymasterAddress = "0x194CC08EFeD09BE41E94b9Bb4c5Aa265662B428e";
const amount = ethers.parseUnits("1.0", 18); // 1 USDC (18 decimals for Sepolia USDC)

// User private key and provider (same as ethertest.js)
const userPrivateKey = process.env.USER_PK || "0x1cdc0890efa3dc7f5d72a128d57eb1ead4c0aac76e37523d9d1ffb2755ae23ab";
const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/709bdd438a58422b891043c58e636a64");
const user = new ethers.Wallet(userPrivateKey, provider);

const erc20Abi = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];
const usdc = new ethers.Contract(usdcAddress, erc20Abi, user);

async function main() {
  console.log("\n=== USDC Approve for Router and Paymaster ===");
  console.log("User:", user.address);
  console.log("USDC:", usdcAddress);
  console.log("Router:", routerAddress);
  console.log("Paymaster:", paymasterAddress);

  // Check current allowances
  const routerAllowance = await usdc.allowance(user.address, routerAddress);
  const paymasterAllowance = await usdc.allowance(user.address, paymasterAddress);
  console.log("Router allowance:", routerAllowance.toString());
  console.log("Paymaster allowance:", paymasterAllowance.toString());

  let didApprove = false;

  // Approve for Router if needed
  if (routerAllowance < amount) {
    console.log("\n🔄 Approving USDC for Router...");
    const tx = await usdc.approve(routerAddress, amount);
    console.log("   Waiting for approval tx:", tx.hash);
    await tx.wait();
    console.log("✅ Router approval confirmed!");
    didApprove = true;
  } else {
    console.log("✅ Router already approved for required amount.");
  }

  // Approve for Paymaster if needed
  if (paymasterAllowance < amount) {
    console.log("\n🔄 Approving USDC for Paymaster...");
    const tx = await usdc.approve(paymasterAddress, amount);
    console.log("   Waiting for approval tx:", tx.hash);
    await tx.wait();
    console.log("✅ Paymaster approval confirmed!");
    didApprove = true;
  } else {
    console.log("✅ Paymaster already approved for required amount.");
  }

  if (!didApprove) {
    console.log("\nAll approvals are already in place! No transactions sent.");
  } else {
    console.log("\nAll required approvals are now set. You can proceed with gasless swaps!");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}); 