import fs from 'node:fs';
import { ethers } from 'ethers';
import { ACTORS } from './config.js';

// Minimal inline ABI, used when ../contracts/abi/PietreDiVita.json is not present.
const INLINE_ABI = [
  'function creaLotto(string codice, string cultivar, string zona, uint64 dataRaccolta, uint32 kgOlive, bytes32 docHash) returns (uint256 id)',
  'function creaLotto(string codice, string cultivar, string zona, uint64 dataRaccolta, uint32 kgOlive) returns (uint256 id)',
  'function aggiungiPasso(uint256 id, uint8 fase, string descrizione, bytes32 docHash)',
  'function imbottiglia(uint256 id, uint32 nBottiglie, bytes32 docHash)',
  'function richiama(uint256 id, string motivo)',
  'function lotto(uint256 id) view returns (tuple(string codice, string cultivar, string zona, uint64 dataRaccolta, uint32 kgOlive, uint32 nBottiglie, bool richiamato, string motivoRichiamo))',
  'function idDaCodice(string codice) view returns (uint256)',
  'function passi(uint256 id) view returns (tuple(uint8 fase, address attore, uint64 timestamp, string descrizione, bytes32 docHash)[])',
  'function verificaBottiglia(string codice, uint32 n) view returns (bool esiste, bool richiamato, uint256 id)',
  'event LottoCreato(uint256 indexed id, string codice, address indexed produttore)',
];

export const ZERO_HASH = '0x' + '00'.repeat(32);
export const toBytes32 = (hex) => (hex ? '0x' + hex : ZERO_HASH);

function loadAbi(abiPath) {
  try {
    const j = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    return Array.isArray(j) ? j : j.abi;
  } catch {
    return INLINE_ABI;
  }
}

/** Returns an object with `enabled` plus the on-chain operations. Offline when env is incomplete. */
export function createChain(cfg) {
  const roles = ACTORS.map((a) => a.ruolo);
  const base = { enabled: false, explorerBase: cfg.explorerBase, addressOf: () => null };
  if (cfg.forceOffline || !cfg.rpcUrl || !cfg.contractAddress) return base;

  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl, cfg.chainId, { staticNetwork: true });
  const iface = new ethers.Interface(loadAbi(cfg.abiPath));
  const wallets = {};
  for (const r of roles) if (cfg.keys[r]) wallets[r] = new ethers.Wallet(cfg.keys[r], provider);
  const reader = new ethers.Contract(cfg.contractAddress, iface, provider);
  const as = (ruolo) => {
    if (!wallets[ruolo]) throw httpError(503, `No wallet key configured for ${ruolo}`);
    return new ethers.Contract(cfg.contractAddress, iface, wallets[ruolo]);
  };
  // Pick the creaLotto overload that takes a docHash when available.
  const creaFrags = iface.fragments.filter((f) => f.type === 'function' && f.name === 'creaLotto');
  const creaFrag = creaFrags.sort((a, b) => b.inputs.length - a.inputs.length)[0];
  const creaWithDoc = creaFrag.inputs.length >= 6;

  async function send(ruolo, fn, args) {
    const c = as(ruolo);
    const tx = await (typeof fn === 'string' ? c[fn] : fn(c))(...args);
    const rcpt = await tx.wait();
    return { txHash: tx.hash, rcpt };
  }

  return {
    enabled: true,
    explorerBase: cfg.explorerBase,
    addressOf: (ruolo) => wallets[ruolo]?.address ?? null,
    async creaLotto(ruolo, l, docHash) {
      const args = [l.codice, l.cultivar, l.zona, l.data_raccolta, l.kg_olive];
      if (creaWithDoc) args.push(docHash);
      const { txHash } = await send(ruolo, (c) => c.getFunction(creaFrag.format()), args);
      const id = await reader.idDaCodice(l.codice);
      return { txHash, tokenId: id.toString() };
    },
    async aggiungiPasso(ruolo, tokenId, fase, descrizione, docHash) {
      return send(ruolo, 'aggiungiPasso', [tokenId, fase, descrizione, docHash]);
    },
    async imbottiglia(ruolo, tokenId, n, docHash) {
      return send(ruolo, 'imbottiglia', [tokenId, n, docHash]);
    },
    async richiama(ruolo, tokenId, motivo) {
      return send(ruolo, 'richiama', [tokenId, motivo]);
    },
    /** Read-only verification data for a lot. */
    async leggi(codice) {
      let id;
      try {
        id = await reader.idDaCodice(codice);
      } catch {
        return { esiste: false, passi: [] }; // contract reverts on unknown code
      }
      if (id === 0n) return { esiste: false, passi: [] };
      const [l, passi] = await Promise.all([reader.lotto(id), reader.passi(id)]);
      return {
        esiste: true,
        id: id.toString(),
        richiamato: l.richiamato,
        nBottiglie: Number(l.nBottiglie),
        passi: passi.map((p) => ({ fase: Number(p.fase), attore: p.attore, docHash: p.docHash })),
      };
    },
  };
}

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
