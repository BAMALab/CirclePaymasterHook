# Circle Paymaster v0.7 Setup Guide

## 🎯 GOAL: True Gasless Transactions (Gas Fees Paid in USDC)

Your current implementation works but **ETH is still being used for gas fees**. To achieve **TRUE gasless transactions** where gas fees are paid in USDC, you need to use Circle Paymaster v0.7 with ERC-4337.

## ✅ What We've Confirmed

1. **Circle Paymaster v0.7 IS deployed on Sepolia**: `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966`
2. **EntryPoint v0.7 IS deployed on Sepolia**: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
3. **Your Smart Account**: `0x9dBa18e9b96b905919cC828C399d313EfD55D800`
4. **USDC Balance**: `24,470,930 units` (available for gas payments)

## 🔧 Required Setup

### 1. Get a Bundler API Key
You need a bundler service to submit ERC-4337 UserOperations:

**Option A: Pimlico (Recommended)**
```
1. Go to: https://pimlico.io
2. Sign up for free account
3. Create a new project
4. Copy your API key
5. Replace in code: https://api.pimlico.io/v2/sepolia/rpc?apikey=YOUR_ACTUAL_API_KEY
```

**Option B: Alchemy**
```
1. Go to: https://alchemy.com
2. Create account and project
3. Enable "Account Abstraction" in dashboard
4. Use: https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

### 2. Update Your .env File
```env
# Sepolia addresses (working configuration)
USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
PAYMASTER_V08_ADDRESS=0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966

# Working private key (has USDC balance)
OWNER_PRIVATE_KEY=0x1cdc0890efa3dc7f5d72a128d57eb1ead4c0aac76e37523d9d1ffb2755ae23ab

# Recipient address
RECIPIENT_ADDRESS=0x9dBa18e9b96b905919cC828C399d313EfD55D800

# Bundler API Key (add this)
BUNDLER_API_KEY=your_api_key_here
```

### 3. Update index.js
Replace the bundler URL in your `index.js`:

```javascript
const bundlerClient = createBundlerClient({
  chain,
  transport: http(`https://api.pimlico.io/v2/sepolia/rpc?apikey=${process.env.BUNDLER_API_KEY}`),
  entryPointAddress: ENTRYPOINT_V07,
});
```

## 🚀 How It Will Work

1. **Smart Account**: Your smart account (`0x9dBa18e9b96b905919cC828C399d313EfD55D800`) executes transactions
2. **Circle Paymaster**: Automatically deducts USDC for gas fees
3. **No ETH Required**: Zero ETH consumption for transaction execution
4. **Bundler**: Handles UserOperation submission and execution

## 📊 Expected Results

**BEFORE (Current):**
```
ETH Balance: 1,792,547,040,563,115 wei
USDC Balance: 24,470,930 units

[Execute Transaction]

ETH Balance: 1,792,260,000,000,000 wei  ← ETH decreased (gas used)
USDC Balance: 24,470,925 units          ← USDC decreased (hook fee only)
```

**AFTER (True Gasless):**
```
ETH Balance: 1,792,547,040,563,115 wei
USDC Balance: 24,470,930 units

[Execute UserOperation with Circle Paymaster]

ETH Balance: 1,792,547,040,563,115 wei  ← ETH unchanged!
USDC Balance: 24,468,000 units          ← USDC decreased (gas + fees)
```

## 🎉 Benefits

1. **True Gasless**: Users pay zero ETH
2. **USDC Gas Payments**: All costs in stable currency
3. **Better UX**: No need to manage ETH balances
4. **Production Ready**: Circle's official paymaster

## 🔄 Migration Path

1. **Keep your working ethertest.js** for Uniswap V4 swaps
2. **Use the new Circle Paymaster approach** for all other transactions
3. **Combine both**: Gasless swaps + gasless transfers/approvals

## 📝 Next Steps

1. Get bundler API key (5 minutes)
2. Update .env file (1 minute)
3. Run updated index.js
4. See **TRUE gasless transactions** in action! 🎉