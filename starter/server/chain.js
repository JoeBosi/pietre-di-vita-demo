const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const network = process.env.NETWORK || "localhost";
const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";

const abi = JSON.parse(
  fs.readFileSync(path.join(root, "artifacts/contracts/MiniOlio.sol/MiniOlio.json"), "utf8")
).abi;
const { address } = JSON.parse(fs.readFileSync(path.join(root, `deployments/${network}.json`), "utf8"));

const provider = new ethers.JsonRpcProvider(rpcUrl);

// Read-only contract: enough for the public page, no key needed
const reader = new ethers.Contract(address, abi, provider);

// Contract that can write: needs a signer.
// On a local node we use the node's first test account. On Amoy we use PRIVATE_KEY from .env.
async function writer() {
  const signer = process.env.PRIVATE_KEY
    ? new ethers.Wallet(process.env.PRIVATE_KEY, provider)
    : await provider.getSigner(0);
  return new ethers.Contract(address, abi, signer);
}

module.exports = { reader, writer, address, ethers };
