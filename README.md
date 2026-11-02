# Pietre di Vita (olive oil traceability demo)

![Frantoio Pietre di Vita · Pietre di Vita Olive Mill](frontend/public/og.jpg)

An educational concept: a fictional Tuscan olive mill whose bottles are traced in four signed phases and verifiable from a QR code. Polygon Amoy testnet only, no real value, all data fictional.

- **Live demo:** https://tracciabilita-olio.blockchain.giuseppebosi.com
- **Tutorial (IT/EN):** https://tracciabilita-olio.blockchain.giuseppebosi.com/tutorial/
- **Verified contracts:** see the Sourcify section at the end.
- **Italian version:** [README.it.md](README.it.md)
- `starter/` has a minimal, working version you can build from scratch (see the tutorial, part "Build your own"). It also holds the small contracts of the chapters (`starter/contracts`), a fingerprint script and a check page (`starter/web`).
- `notebooks/` has two Google Colab notebooks (English and Italian) that verify a real bottle with Python: [open in Colab](https://colab.research.google.com/github/JoeBosi/pietre-di-vita-demo/blob/main/notebooks/pietre_di_vita_verify_en.ipynb).
- **Author:** Prof. Giuseppe Bosi, https://www.giuseppebosi.com , https://www.linkedin.com/in/giuseppebosi
- **License:** MIT (see [LICENSE](LICENSE)).

A fictional Tuscan mill. Each oil lot is an ERC-721 token; every production step (harvest, milling, lab analysis, bottling) is signed on-chain by the actor who did it, with the sha256 of its proof document. Consumers scan a bottle QR code and see the chain-verified history. All data is fictional, testnet only.

## Parts
- `contracts/`: Solidity (Hardhat, OpenZeppelin 5), roles and ordered phases. See its README.
- `backend/`: Node/Express + SQLite, users, uploads, signs transactions per actor ("simple custody"). See its README.
- `frontend/`: consumer page (`/b/:codice/:n`) and supply-chain console (`/filiera`).

## Run locally (on-chain mode, ~6 commands)
```
cd contracts && npm install && npx hardhat node &                # chain on 127.0.0.1:8545
cd contracts && npx hardhat run scripts/deploy.ts --network localhost   # roles -> signers #1..#4
cd backend && npm install && cp .env.example .env                # then edit, see below
cd backend && npm run seed                                       # 4 users + 3 lots on chain
cd backend && npm start                                          # 127.0.0.1:3802
cd frontend && npm install && npm run dev
```
Backend `.env` for the local chain: `RPC_URL=http://127.0.0.1:8545`, `CHAIN_ID=31337`, `CONTRACT_ADDRESS=<"contract" in contracts/deployments/localhost.json>`, `KEY_PRODUTTORE`/`KEY_FRANTOIO`/`KEY_LABORATORIO`/`KEY_IMBOTTIGLIATORE` = Hardhat default private keys of accounts #1..#4 (public test keys), `NETWORK=localhost` (only for `npm run seed`, selects `deployments/<NETWORK>.json`; default `amoy`). To use another port for the node, set `LOCALHOST_RPC_URL` when deploying.

## Trial mode ("Prova la filiera")
Anyone can try the supply chain at `/filiera#prova` with no password: the visitor picks the four roles in turn and records the steps on a private `PROVA-xxxx` lot, then opens their own bottle (public page + QR). The server wallets pay for the transactions, so it is capped; all limits are env variables (defaults): `DEMO_RUNS_PER_IP_DAY=3`, `DEMO_REQ_PER_MIN=60`, `DEMO_TX_PER_DAY=150` (global), `DEMO_MIN_POL=0.5` (an actor wallet below this pauses the trial; reported in `/api/health` as `lowFunds`, in the log and in `data/demo-status.json`), `DEMO_ENABLED=1`. Trial lots use a separate cookie, can only be written by their own session, and are excluded from every list. A full path costs 4 transactions, about 0.021 POL. Details: `docs/specifiche.md`.

## Offline vs on-chain
- On-chain: `RPC_URL` and `CONTRACT_ADDRESS` set. The chain call goes first, the DB is written only on success; `/api/health` reports `mode: "onchain"`.
- Offline: leave them empty. DB only, `tx_hash` null, `/api/health` reports `mode: "offline"`, public verification returns `onchain: false`. Offline lots cannot be pushed on-chain later.

## Demo users and lots
Users `agricoltore`, `frantoio`, `laboratorio`, `imbottigliatore`; initial passwords from `INITIAL_PASSWORD_*` (fallback `change-me-<user>`), changed at first login (min 10 chars).
Lots `25B001` (360 bottles), `25B002` (270), `25B003` (240, recalled). Try `/api/pubblico/bottiglia/25B001/1`.

## Deploy on Polygon Amoy (chain 80002)
1. Create 5 wallets (deployer + 4 actors) and fund each with test POL from the Amoy faucet.
2. `contracts/.env`: `AMOY_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `PRODUTTORE_ADDRESS`, `FRANTOIO_ADDRESS`, `LABORATORIO_ADDRESS`, `IMBOTTIGLIATORE_ADDRESS`, optional `POLYGONSCAN_API_KEY`.
3. `npx hardhat run scripts/deploy.ts --network amoy` (writes `deployments/amoy.json`); optionally `scripts/verify.ts`.
4. `backend/.env`: `RPC_URL`, `CHAIN_ID=80002`, `CONTRACT_ADDRESS`, the four `KEY_*`, `SESSION_SECRET`, `INITIAL_PASSWORD_*`, `PUBLIC_BASE_URL`.
5. `npm run seed` (NETWORK defaults to `amoy`), then `npm start`.
6. Verify: `/api/health` is onchain; `/api/pubblico/bottiglia/25B001/1` has `verifica.onchain` true and every `hashMatch.match` true; `25B003` shows as recalled. Never commit `.env` files.

## Verified source (Sourcify, Polygon Amoy)
- PietreDiVita: https://repo.sourcify.dev/80002/0x158a5026eD83888a443f2bA921Faf07C2D04bE0E

Re-run with `node contracts/scripts/verify-sourcify.js 80002 <address> PietreDiVita`.
