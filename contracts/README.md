# Pietre di Vita - smart contract

Olive oil traceability for a fictional Tuscan mill. Hardhat 2, ethers v6, TypeScript, OpenZeppelin 5.

## What it models
- **Lot = token.** Each olive-oil lot is an ERC-721 token ("Pietre di Vita Lotto", `PDV`), ids sequential from 1, minted to the producer. The lot `codice` is unique.
- **Phases**, strictly in order: Raccolta (harvest) > Molitura (milling) > Analisi (lab analysis) > Imbottigliamento (bottling) > Spedizione (shipping, repeatable). Each step stores actor, timestamp, description and the hash of a proof document; steps are append-only.
- **Roles** (OpenZeppelin AccessControl): `PRODUTTORE_ROLE` (creates lots, ships, recalls), `FRANTOIO_ROLE` (Molitura), `LABORATORIO_ROLE` (Analisi), `IMBOTTIGLIATORE_ROLE` (Imbottigliamento).
- **Bottling** is done with `imbottiglia`, which records the step and fixes `nBottiglie` once. `aggiungiPasso` handles Molitura, Analisi and Spedizione (Raccolta is recorded by `creaLotto`).
- **Recall:** `richiama` flags a lot once, with a reason.
- **Consumer verification:** `verificaBottiglia(codice, n)` returns `(esiste, richiamato, id)`; a bottle exists if the lot exists and `1 <= n <= nBottiglie`.

Custom errors: `CodiceDuplicato`, `FaseFuoriOrdine`, `RuoloNonAutorizzato`, `LottoInesistente`, `GiaImbottigliato`, `GiaRichiamato`, `NumeroBottiglieNullo`.

## Setup
```
npm install
cp .env.example .env   # fill only for non-local networks
npm test
```

## Deploy and seed
Local in-process network (state is lost when the command ends, so use a node to keep it):
```
npx hardhat node                                          # terminal 1
npx hardhat run scripts/deploy.ts --network localhost     # terminal 2
npx hardhat run scripts/seed.ts   --network localhost
```
`deploy.ts` grants the four roles to `PRODUTTORE_ADDRESS`, `FRANTOIO_ADDRESS`, `LABORATORIO_ADDRESS`, `IMBOTTIGLIATORE_ADDRESS` from `.env` (on hardhat/localhost it falls back to signers 1-4). It writes `deployments/<network>.json` and `abi/PietreDiVita.json`.

`seed.ts` creates three fictional 2025 lots (`25B001`, `25B002`, `25B003`, the last one recalled), using the local signers as actors. Testnet (Polygon Amoy, chain 80002): set `AMOY_RPC_URL` and `DEPLOYER_PRIVATE_KEY`, then `--network amoy`. `scripts/verify.ts` verifies the source on the explorer (`POLYGONSCAN_API_KEY`).

Note: the EVM target is `cancun` (required by OpenZeppelin 5.x).
