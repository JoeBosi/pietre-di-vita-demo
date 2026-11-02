// Verify deployed contracts on Sourcify (API v2). Usage:
//   node scripts/verify-sourcify.js <chainId> <address> <ContractName>
// Uses the standard-json input saved by Hardhat in artifacts/build-info, so the
// compiler settings are identical to the ones used at deploy time.
const fs = require("fs");
const path = require("path");
const SERVER = "https://sourcify.dev/server";

async function main() {
  const [chainId, address, name] = process.argv.slice(2);
  if (!chainId || !address || !name) throw new Error("usage: verify-sourcify.js <chainId> <address> <ContractName>");
  const dir = path.resolve(__dirname, "..", "artifacts", "build-info");
  let found;
  for (const f of fs.readdirSync(dir)) {
    const bi = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const [src, cs] of Object.entries(bi.output.contracts)) {
      if (cs[name] && src.startsWith("contracts/")) found = { bi, src };
    }
  }
  if (!found) throw new Error("contract not found in build-info: " + name);
  const body = {
    stdJsonInput: found.bi.input,
    compilerVersion: found.bi.solcLongVersion.replace(/^/, ""),
    contractIdentifier: `${found.src}:${name}`,
  };
  const r = await fetch(`${SERVER}/v2/verify/${chainId}/${address}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json();
  console.log(r.status, JSON.stringify(j));
  if (!j.verificationId) process.exit(1);
  for (let i = 0; i < 30; i++) {
    await new Promise((s) => setTimeout(s, 3000));
    const s = await (await fetch(`${SERVER}/v2/verify/${j.verificationId}`)).json();
    if (s.isJobCompleted) { console.log(JSON.stringify(s.contract || s.error || s)); return; }
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
