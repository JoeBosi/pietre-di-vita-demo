import { ethers, network, run } from "hardhat";
import { readDeployment } from "./common";

// Verifies the contract source on the block explorer (needs POLYGONSCAN_API_KEY).
async function main() {
  const dep = readDeployment(network.name);
  await run("verify:verify", { address: dep.contract, constructorArguments: [dep.admin] });
  console.log("Verified", dep.contract);
  void ethers;
}
main().catch((e) => { console.error(e); process.exit(1); });
