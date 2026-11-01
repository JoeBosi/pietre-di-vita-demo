import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" } },
  networks: {
    hardhat: {},
    localhost: { url: process.env.LOCALHOST_RPC_URL || "http://127.0.0.1:8545" },
    amoy: {
      url: process.env.AMOY_RPC_URL || "",
      chainId: 80002,
      accounts: deployerKey ? [deployerKey] : [],
    },
  },
  etherscan: { apiKey: process.env.POLYGONSCAN_API_KEY || "" },
};
export default config;
