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
const amountIn = ethers.parseUnits("1.0", 18); // 1 token, adjust decimals as needed
const amountOutMin = 0; // Accept any amount out (not safe for production)
const zeroForOne = true; // true if swapping currency0 for currency1
// const hookData = ethers.utils.defaultAbiCoder.encode(["bool", "address"], [true, "YOUR_ADDRESS"]);
const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

// --- Provider and Signer ---
const provider = new ethers.JsonRpcProvider(
  "https://sepolia.infura.io/v3/709bdd438a58422b891043c58e636a64"
);
const account = new ethers.Wallet(
  "0x3de4897ccd7d584ca6cc0922795d24da80bca084bbb9bc3e8645c5a6a190eb95",
  provider
);
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
  const hookData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bool", "address"],
    [true, account.address]
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
  console.log("USDC balance:", balance.toString());
  console.log("USDC allowance:", allowance.toString());
  if (balance < amountIn) {
    console.error("Insufficient USDC balance for swap");
    return;
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
  } catch (e) {
    console.error("Swap failed:", e.message);
    if (e.receipt) {
      console.log("Transaction receipt:", e.receipt);
    }
  }
})();
