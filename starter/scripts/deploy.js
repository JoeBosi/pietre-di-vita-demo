const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const olio = await hre.ethers.deployContract("MiniOlio");
  await olio.waitForDeployment();
  const address = await olio.getAddress();
  console.log("MiniOlio deployed to:", address, "on network:", hre.network.name);

  // Save the address: the backend reads it from here
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(`deployments/${hre.network.name}.json`, JSON.stringify({ address }, null, 2) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
