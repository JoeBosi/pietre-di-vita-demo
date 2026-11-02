import { Contract, JsonRpcProvider } from "ethers";

// Public values of the demo: the contract on Polygon Amoy (chain id 80002) and a free public RPC address.
const CONTRACT_ADDRESS = "0x158a5026eD83888a443f2bA921Faf07C2D04bE0E";
const RPC_URL = "https://polygon-amoy-bor-rpc.publicnode.com";

// Only the function we call, in human-readable form.
const abi = [
  "function verificaBottiglia(string codice, uint32 n) view returns (bool esiste, bool richiamato, uint256 id)",
];
const contract = new Contract(CONTRACT_ADDRESS, abi, new JsonRpcProvider(RPC_URL, 80002, { staticNetwork: true }));

const link = document.getElementById("contract-link");
link.href = `https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}`;
link.textContent = CONTRACT_ADDRESS;

const result = document.getElementById("result");
function show(cls, text) {
  result.className = `v ${cls}`;
  result.textContent = text;
}

async function check() {
  const lot = document.getElementById("lot").value.trim();
  const n = Number(document.getElementById("n").value);
  if (!lot || !Number.isInteger(n) || n < 0) return show("red", "Enter a lot code and a whole bottle number.");
  show("grey", "Reading the chain...");
  try {
    const [esiste, richiamato, id] = await contract.verificaBottiglia(lot, n);
    if (id === 0n) return show("red", `RED: unknown lot "${lot}"`);
    if (richiamato) return show("red", `RED: lot ${lot} is recalled, do not use`);
    if (!esiste) return show("red", `RED: bottle ${n} does not exist in lot ${lot}`);
    show("green", `GREEN: bottle ${n} of lot ${lot} is valid (token ${id})`);
  } catch (err) {
    show("red", `Could not read the chain (${err.shortMessage || err.message}). Try again in a minute.`);
  }
}

document.getElementById("go").addEventListener("click", check);
check();
