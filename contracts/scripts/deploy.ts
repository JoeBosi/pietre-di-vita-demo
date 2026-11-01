import { ethers, network, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { ROOT, deploymentPath } from "./common";

async function main() {
  const signers = await ethers.getSigners();
  const [admin] = signers;
  const fromEnv = (k: string, i: number) => {
    const v = process.env[k];
    if (v) return ethers.getAddress(v);
    if (network.name === "hardhat" || network.name === "localhost") return signers[i].address;
    throw new Error(`${k} is required on network ${network.name}`);
  };
  const roles = {
    PRODUTTORE_ROLE: fromEnv("PRODUTTORE_ADDRESS", 1),
    FRANTOIO_ROLE: fromEnv("FRANTOIO_ADDRESS", 2),
    LABORATORIO_ROLE: fromEnv("LABORATORIO_ADDRESS", 3),
    IMBOTTIGLIATORE_ROLE: fromEnv("IMBOTTIGLIATORE_ADDRESS", 4),
  };

  const c = await (await ethers.getContractFactory("PietreDiVita")).deploy(admin.address);
  await c.waitForDeployment();
  const receipt = await c.deploymentTransaction()!.wait();
  for (const [name, addr] of Object.entries(roles)) {
    await (await c.grantRole(await (c as any)[name](), addr)).wait();
  }

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const block = await ethers.provider.getBlock("latest");
  const out = {
    chainId,
    contract: await c.getAddress(),
    admin: admin.address,
    roles,
    blockNumber: receipt!.blockNumber,
    timestamp: block!.timestamp,
  };
  fs.mkdirSync(path.dirname(deploymentPath(network.name)), { recursive: true });
  fs.writeFileSync(deploymentPath(network.name), JSON.stringify(out, null, 2) + "\n");

  const art = await artifacts.readArtifact("PietreDiVita");
  fs.mkdirSync(path.join(ROOT, "abi"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "abi", "PietreDiVita.json"), JSON.stringify(art.abi, null, 2) + "\n");
  console.log(`PietreDiVita deployed on ${network.name} at ${out.contract}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
