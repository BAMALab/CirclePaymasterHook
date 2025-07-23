import { ethers } from "ethers";
import { readFile } from "fs/promises";
const abi = JSON.parse(await readFile(new URL("./abi.json", import.meta.url)));

// --- Setup ---
const swapAddress = "0x00000000000044a361Ae3cAc094c9D1b14Eece97"; // Uniswap V4 router
const currency0 = "0x3B4c3885E8144af60A101c75468727863cFf23fA"; // e.g., USDC
const currency1 = "0x90954dcFB08C84e1ebA306f59FAD660b3A7B5808"; // e.g., WETH
const fee = 5000;
const tickSpacing = 100;
const hooks = "0xc9e902b5047433935C8f6B173fC936Fd696C00c0";
const circlePaymasterIntegration = "0x194CC08EFeD09BE41E94b9Bb4c5Aa265662B428e"; // Circle Paymaster Integration
const permit2Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // Permit2 address
const amountIn = ethers.parseUnits("1.0", 18); // 1 token, adjust decimals as needed
const amountOutMin = 0; // Accept any amount out (not safe for production)
const zeroForOne = true; // true if swapping currency0 for currency1
// const hookData = ethers.utils.defaultAbiCoder.encode(["bool", "address"], [true, "YOUR_ADDRESS"]);
const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

// --- Provider and Signer ---
const provider = new ethers.JsonRpcProvider(
  "https://sepolia.infura.io/v3/709bdd438a58422b891043c58e636a64"
);
// 0x3de4897ccd7d584ca6cc0922795d24da80bca084bbb9bc3e8645c5a6a190eb95
// 1cdc0890efa3dc7f5d72a128d57eb1ead4c0aac76e37523d9d1ffb2755ae23ab no eth address but usdc is availabel
const account = new ethers.Wallet(
  "0x1cdc0890efa3dc7f5d72a128d57eb1ead4c0aac76e37523d9d1ffb2755ae23ab",
  provider
);
// To test with insufficient funds, change the private key to a different address:
// "0x1234567890123456789012345678901234567890123456789012345678901234"
const recipientAddress = process.env.RECIPIENT_ADDRESS || account.address;

// --- ABI for the function ---
// const abi = [
//   "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, bool zeroForOne, tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bytes hookData, address receiver, uint256 deadline) returns (int256, int256)",
// ];

// --- Contract instance ---
const router = new ethers.Contract(swapAddress, abi, account);

// Debug: Check if router is properly instantiated
console.log("Router address:", swapAddress);
console.log("Router contract:", router);
console.log("Router interface:", router.interface);

// Check if the function exists on the contract
console.log("Available functions on router:");
console.log(
  Object.getOwnPropertyNames(Object.getPrototypeOf(router)).filter(
    (name) => typeof router[name] === "function" && name !== "constructor"
  )
);

// Check if swapExactTokensForTokens function exists
console.log(
  "swapExactTokensForTokens function exists:",
  typeof router.swapExactTokensForTokens
);
if (typeof router.swapExactTokensForTokens === "function") {
  console.log(
    "Function signature:",
    router.swapExactTokensForTokens.fragment?.format()
  );
}

// Print all function signatures in the ABI
console.log("All function signatures in ABI:");
for (const fragment of router.interface.fragments) {
  if (fragment.type === "function") {
    console.log(fragment.format());
  }
}

// --- PoolKey struct as array (tuple) for ethers.js v6 ---
// Order: [currency0, currency1, fee, tickSpacing, hooks]
const poolKey = [currency0, currency1, fee, tickSpacing, hooks];

// Wrap the main logic in an async IIFE for top-level await
(async () => {
  // --- Encode hookData after account is defined ---
  // Encode hook data for gasless mode: (bool gasless, address user)
  const hookData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bool", "address"],
    [true, account.address] // true = gasless mode, account.address = user address
  );

// --- Approve tokens if needed (example for ERC20) ---
const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
];
const token0 = new ethers.Contract(currency0, erc20Abi, account);

  // Check balance and allowance
  const balance = await token0.balanceOf(account.address);
  const allowance = await token0.allowance(account.address, swapAddress);
  const paymasterAllowance = await token0.allowance(
    account.address,
    circlePaymasterIntegration
  );
  const ethBalance = await provider.getBalance(account.address);

  console.log("=== BEFORE SWAP ===");
  console.log("USDC balance:", balance.toString());
  console.log("ETH balance:", ethers.formatEther(ethBalance), "ETH");
  console.log("USDC allowance:", allowance.toString());
  console.log("USDC paymaster allowance:", paymasterAllowance.toString());
  console.log("==================");

  console.log(
    "🔄 Gasless mode: User will pay gas fees in USDC via Circle Paymaster"
  );

  // Function to create gasless approval using Permit2
  async function createGaslessApproval(tokenAddress, spender, amount) {
    console.log("Creating gasless approval using Permit2...");

    // Get current nonce for Permit2
    const permit2Abi = [
      "function nonceBitmap(address, uint48) view returns (uint256)",
      "function nonceBitmap(address, uint48, uint48) view returns (uint256)",
    ];
    const permit2 = new ethers.Contract(permit2Address, permit2Abi, provider);

    // Get current timestamp and deadline
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    // Create permit data
    const permitData = {
      permitted: {
        token: tokenAddress,
        amount: amount,
      },
      nonce: 0, // You might need to track this properly
      deadline: deadline,
    };

    // For now, we'll use a simpler approach with gasless approval
    console.log("⚠️  Gasless approval not fully implemented yet");
    console.log("   Please get a small amount of ETH for one-time approvals");
    return false;
  }

  // Check if user has ETH for approval transactions
  if (ethBalance < ethers.parseEther("0.001")) {
    console.error("❌ Insufficient ETH for approval transactions!");
    console.error("");
    console.error("The gasless swap works as follows:");
    console.error(
      "  1. Approval transactions require ETH for gas (one-time setup)"
    );
    console.error("  2. The actual swap transaction is gasless (paid in USDC)");
    console.error("");
    console.error("Solutions:");
    console.error(
      "  • Get a small amount of Sepolia ETH for approvals: https://sepoliafaucet.com/"
    );
    console.error("  • Or use an address that already has approved tokens");
    console.error("  • Or use Permit2 for gasless approvals (advanced)");
    console.error("");
    console.error("Current status:");
    console.error(
      "  • Router approval needed:",
      allowance < amountIn ? "YES" : "NO"
    );
    console.error(
      "  • Paymaster approval needed:",
      paymasterAllowance < amountIn ? "YES" : "NO"
    );
    console.error("");
    console.error(
      "💡 Tip: You only need ETH for the first approval. After that, all swaps are gasless!"
    );
    return;
  }

  if (balance < amountIn) {
    console.error("Insufficient USDC balance for swap");
    return;
  }

  // Approve USDC for Circle Paymaster Integration (for gas fees)
  if (paymasterAllowance < amountIn) {
    console.log("Approving USDC for Circle Paymaster Integration...");
    const approvePaymasterTx = await token0.approve(
      circlePaymasterIntegration,
      amountIn
    );
    await approvePaymasterTx.wait();
    console.log("Paymaster approval confirmed");
  }

  if (allowance < amountIn) {
    console.log("Approving USDC for router...");
    const approveTx = await token0.approve(swapAddress, amountIn);
    await approveTx.wait();
    console.log("Approval confirmed");
  }

  // Print all swap parameters
  console.log("Swap parameters:");
  console.log({
    amountIn: amountIn.toString(),
    amountOutMin: amountOutMin.toString(),
    zeroForOne,
    poolKey,
    hookData,
    recipientAddress,
    deadline,
  });

  // --- Try simulate to get revert reason (with original hookData) ---
  console.log("\n--- simulate check with original hookData ---");
  try {
    const result = await router.swapExactTokensForTokens.staticCall(
  amountIn,
  amountOutMin,
  zeroForOne,
  poolKey,
  hookData,
  recipientAddress,
  deadline
);
    console.log(
      "simulate: Swap would succeed (original hookData), result:",
      result
    );
  } catch (e) {
    console.error("simulate revert reason (original hookData):", e.message);
    // Try to decode the revert data
    if (e.value) {
      console.log("Revert data:", e.value);
    }
  }

  // --- Try simulate with empty hookData ---
  console.log("\n--- simulate check with empty hookData ---");
  try {
    const result = await router.swapExactTokensForTokens.staticCall(
      amountIn,
      amountOutMin,
      zeroForOne,
      poolKey,
      "0x",
      recipientAddress,
      deadline
    );
    console.log(
      "simulate: Swap would succeed (empty hookData), result:",
      result
    );
  } catch (e) {
    console.error("simulate revert reason (empty hookData):", e.message);
    // Try to decode the revert data
    if (e.value) {
      console.log("Revert data:", e.value);
    }
  }

  // --- Try direct call to function (should revert if not working) ---
  try {
    console.log("Sending swap transaction...");
    // First, populate the transaction to get the encoded data
    const populatedTx =
      await router.swapExactTokensForTokens.populateTransaction(
        amountIn,
        amountOutMin,
        zeroForOne,
        poolKey,
        hookData,
        recipientAddress,
        deadline,
        { value: 0 }
      );

    console.log("Populated transaction data:", populatedTx.data);
    console.log("Populated transaction to:", populatedTx.to);

    // Now send the transaction with the encoded data
    // Manually construct the transaction object
    const txObject = {
      to: populatedTx.to,
      data: populatedTx.data,
      value: populatedTx.value || 0n,
      gasLimit: populatedTx.gasLimit || 300000n,
    };

    console.log(
      "Sending transaction with data:",
      txObject.data.substring(0, 66) + "..."
    );

    // Send the transaction using the wallet
    const txResponse = await account.sendTransaction(txObject);

    console.log("Swap transaction sent! Hash:", txResponse.hash);
    const receipt = await txResponse.wait();
    console.log("Swap confirmed! Receipt:", receipt);
    if (receipt && receipt.logs) {
      console.log("Event logs:", receipt.logs);
    }

    // --- Get and log balances after the swap ---
    const balanceAfter = await token0.balanceOf(account.address);
    const ethBalanceAfter = await provider.getBalance(account.address);
    console.log("=== AFTER SWAP ===");
    console.log("USDC balance:", balanceAfter.toString());
    console.log("ETH balance:", ethers.formatEther(ethBalanceAfter), "ETH");
    console.log("=================");
  } catch (e) {
    console.error("Swap failed:", e.message);

    // Check for specific error types
    if (
      e.message.includes("insufficient funds") ||
      e.message.includes("insufficient balance")
    ) {
      console.error("❌ Insufficient funds error detected!");
      console.error("This usually means:");
      console.error("  1. Not enough USDC tokens for the swap");
      console.error("  2. Not enough USDC for gas fees (gasless mode)");
      console.error("  3. USDC approval issues");
      console.error("");
      console.error("Solutions:");
      console.error("  • Get Sepolia USDC from: https://sepoliafaucet.com/");
      console.error("  • Check your token balances above");
      console.error(
        "  • Ensure USDC is approved for both router and paymaster"
      );
    } else if (e.message.includes("nonce")) {
      console.error("❌ Nonce error - try again in a few seconds");
    } else if (e.message.includes("revert")) {
      console.error(
        "❌ Transaction reverted - check contract state and parameters"
      );
    }

    if (e.receipt) {
      console.log("Transaction receipt:", e.receipt);
    }
  }
})();
