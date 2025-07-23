// Usage: node get_deployed_address.js <deploy_script_name> <chain_id> [<contract_name>]
// Example: node get_deployed_address.js 01_CreatePoolAndAddLiquidity.s.sol 11155111 Pool

const fs = require("fs");
const path = require("path");

if (process.argv.length < 4) {
  console.error(
    "Usage: node get_deployed_address.js <deploy_script_name> <chain_id> [<contract_name>]"
  );
  process.exit(1);
}

const [, , deployScript, chainId, contractName] = process.argv;

const broadcastDir = path.join(__dirname, "broadcast", deployScript, chainId);

if (!fs.existsSync(broadcastDir)) {
  console.error("Broadcast directory not found:", broadcastDir);
  process.exit(1);
}

// Find the latest run-*.json file
const files = fs
  .readdirSync(broadcastDir)
  .filter((f) => f.startsWith("run-") && f.endsWith(".json"))
  .sort(
    (a, b) =>
      fs.statSync(path.join(broadcastDir, b)).mtimeMs -
      fs.statSync(path.join(broadcastDir, a)).mtimeMs
  );

if (files.length === 0) {
  console.error("No broadcast files found in:", broadcastDir);
  process.exit(1);
}

const latestFile = path.join(broadcastDir, files[0]);
const data = JSON.parse(fs.readFileSync(latestFile, "utf8"));

let found = false;
if (contractName) {
  for (const tx of data.transactions || []) {
    if (tx.contractName === contractName && tx.contractAddress) {
      console.log(`${contractName} deployed at: ${tx.contractAddress}`);
      found = true;
    }
  }
  if (!found) {
    console.error(`Contract ${contractName} not found in ${latestFile}`);
  }
} else {
  // Print all contract addresses for inspection
  for (const tx of data.transactions || []) {
    if (tx.contractAddress) {
      console.log(
        `${tx.contractName || "UnknownContract"} deployed at: ${
          tx.contractAddress
        }`
      );
      found = true;
    }
  }
  if (!found) {
    console.error(`No contract addresses found in ${latestFile}`);
  }
}
