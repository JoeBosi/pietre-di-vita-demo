# Pietre di Vita - backend

Backend of the "Pietre di Vita" demo: traceability of olive oil from a fictional Tuscan mill.
Each lot is an ERC-721 token on the `PietreDiVita` contract (Polygon Amoy testnet). The backend keeps
users, uploaded documents (SQLite) and signs transactions on behalf of the logged-in actor
("simple custody": one wallet per actor, keys in `.env`, testnet only). Data and actors are fictional.

## Phases and who may do what

| Phase | Actor (user) | Role | Evidence |
|---|---|---|---|
| 0 Raccolta (harvest) | agricoltore | PRODUTTORE | photo (optional) |
| 1 Molitura (milling) | frantoio | FRANTOIO | photo or sheet |
| 2 Analisi (lab) | laboratorio | LABORATORIO | PDF report (required) |
| 3 Imbottigliamento (bottling) | imbottigliatore | IMBOTTIGLIATORE | label photo |
| 4 Spedizione (shipping, optional) | agricoltore | PRODUTTORE | - |
| Richiamo (recall) | agricoltore | PRODUTTORE | reason |

Phases must follow this order (enforced by the API and by the contract). A recalled lot accepts no more steps.
The sha256 of every uploaded file is computed by the server and stored on-chain as `docHash`.

## Run

    npm install
    cp .env.example .env     # edit
    npm run seed             # users + 3 demo lots (idempotent)
    npm start                # listens on 127.0.0.1:PORT (default 3802) only
    npm test

Requires Node 22.13+ (uses the built-in `node:sqlite`). Put a reverse proxy in front for public access.

## Offline vs on-chain mode

- **On-chain**: `RPC_URL` and `CONTRACT_ADDRESS` set (plus the four `KEY_*`). The chain call is made first; the DB is written only if it succeeds.
  The ABI is loaded from `../contracts/abi/PietreDiVita.json` when present, else a minimal inline ABI is used.
- **Offline**: `RPC_URL` or `CONTRACT_ADDRESS` empty. Everything is stored in the DB only, `tx_hash` is `null`,
  every response carries `"offline": true` and `/api/health` reports `mode: "offline"`. Public verification returns `verifica.onchain = false`.
  Lots created offline have no token and cannot later be pushed on-chain.

## Users

`agricoltore`, `frantoio`, `laboratorio`, `imbottigliatore`. Initial passwords come from `INITIAL_PASSWORD_*`
(a `change-me-<user>` fallback is used if unset). `must_change_password` is set; write endpoints answer 403
`MUST_CHANGE_PASSWORD` until `POST /api/cambia-password` is called (min 10 characters). Passwords are stored with bcrypt.
Sessions use an httpOnly signed cookie.

## API

Auth (cookie session):
- `POST /api/login` `{username, password}`, `POST /api/logout`, `GET /api/me`, `POST /api/cambia-password` `{vecchia, nuova}`
- `GET /api/lotti`
- `POST /api/lotti` (PRODUTTORE, multipart: `codice, cultivar, zona, data_raccolta` (YYYY-MM-DD or unix s), `kg_olive`, optional `photo`)
- `POST /api/lotti/:codice/passi` (multipart: `fase` 1..4, `descrizione`, `file`; fase 3 is forwarded to imbottiglia and needs `n_bottiglie`)
- `POST /api/lotti/:codice/imbottiglia` (multipart: `n_bottiglie`, `file`)
- `POST /api/lotti/:codice/richiamo` (PRODUTTORE, JSON `{motivo}`)

Public:
- `GET /api/pubblico/lotto/:codice`
- `GET /api/pubblico/bottiglia/:codice/:n` (404 if `n` is outside 1..n_bottiglie)
- `GET /api/qr/:codice/:n.png` (QR of `${PUBLIC_BASE_URL}/b/<codice>/<n>`)
- `GET /api/documenti/:id`, `GET /api/health`

Public responses: `{lotto, passi[], verifica, offline}` where each step has actor, time, `tx_hash`, `tx_url`
and `documento {id, filename, mime, sha256, url}`, and
`verifica = {onchain, esiste, richiamato, hashMatch[{fase, documento_id, dbSha256, onchainHash, match}], explorerBase}`.

Uploads: `data/uploads/`, max 5 MB, pdf/jpg/png only (declared type and file signature must agree).

## Seed

`npm run seed` creates the users and lots `25A001`..`25A003` (all phases, placeholder PNGs and a small PDF; `25A003` is recalled).
If the chain is configured and `../contracts/deployments/<NETWORK>.json` exists (default `amoy`) the lots go on-chain,
otherwise the DB only. Existing lots are skipped.

## Deploy

`deploy/olio-backend.service` is an example systemd unit (not installed). The server binds to 127.0.0.1 only.
