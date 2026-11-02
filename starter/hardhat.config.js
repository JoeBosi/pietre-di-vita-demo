require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ quiet: true });

// Local node address. If port 8545 is busy on your computer, set RPC_URL in .env
const networks = {
  localhost: { url: process.env.RPC_URL || "http://127.0.0.1:8545" },
};
// The Amoy network is added only if you filled in .env
if (process.env.AMOY_RPC_URL && process.env.DEPLOYER_PRIVATE_KEY) {
  networks.amoy = {
    url: process.env.AMOY_RPC_URL,
    chainId: 80002,
    accounts: [process.env.DEPLOYER_PRIVATE_KEY],
  };
}

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
  },
  networks,
};
