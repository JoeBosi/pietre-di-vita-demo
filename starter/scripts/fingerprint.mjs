// Chapter 7: compute the SHA-256 fingerprint of a file and check it against a value read from the chain.
// Usage: node scripts/fingerprint.mjs report.txt [expected-fingerprint]
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// The fingerprint is 32 bytes, written as 64 hexadecimal characters with the 0x prefix (a bytes32 value).
function fingerprint(fileBytes) {
  return "0x" + createHash("sha256").update(fileBytes).digest("hex");
}

// The file downloaded by a visitor must give the same fingerprint that is stored on the chain.
function documentIsIntact(fileBytes, hashOnChain) {
  return fingerprint(fileBytes) === hashOnChain.toLowerCase();
}

const [file, expected] = process.argv.slice(2);
if (!file) {
  console.error("Usage: node scripts/fingerprint.mjs <file> [expected-fingerprint]");
  process.exit(1);
}
const bytes = readFileSync(file);
console.log(fingerprint(bytes));
if (expected) console.log("Matches the expected fingerprint:", documentIsIntact(bytes, expected));
