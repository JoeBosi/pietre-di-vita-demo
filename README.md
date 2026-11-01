# Pietre di Vita (olive oil traceability demo)

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
