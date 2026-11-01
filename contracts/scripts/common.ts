import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

export const ROOT = path.resolve(__dirname, "..");
export const deploymentPath = (network: string) => path.join(ROOT, "deployments", `${network}.json`);
export const H = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

export function readDeployment(network: string) {
  const p = deploymentPath(network);
  if (!fs.existsSync(p)) throw new Error(`Missing ${p}: run deploy first`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
