# Pietre di Vita - frontend

Public site and supply-chain area of demo 2 "Pietre di Vita" (a fictional Tuscan olive oil mill; every bottle is traceable).
React 18 + TypeScript (strict) + Vite + Tailwind CSS v4 + react-router. No wallet library: consumers verify without a wallet,
and the supply-chain actors act through the backend. UI in Italian with an English toggle (`src/i18n.ts`).

## Pages

- `/` home with a sample QR code; `/b/:codice/:n` bottle page (status badge, timeline, proofs);
- `/come-funziona` plain-language explanation; `/filiera` actors area (login, lots, role-based actions).

## Run

    npm install
    cp .env.example .env     # optional
    npm run dev              # http://127.0.0.1:5174
    npm run build            # type-check + production build into dist/
    npm test                 # vitest (src/lib/verifica.ts)

## Environment

- `VITE_API_URL` backend base URL. Default: `http://127.0.0.1:3802` in a production build; in `npm run dev` it is empty
  and `/api` is proxied to `http://127.0.0.1:3802` by Vite (the backend sends no CORS headers, and the session is a cookie).
  For production, serve the built `dist/` and reverse-proxy `/api/*` to the backend on the same host, leaving `VITE_API_URL` empty.

## Backend dependency

Needs `../backend` running (`npm run seed` then `npm start`, binds 127.0.0.1:3802). In offline mode (no chain configured)
bottle pages show the amber "not yet verifiable" badge; with a deployed contract they show the green one.

## Demo data

Lots `25A001`, `25A002`, `25A003` (all phases done; `25A003` is recalled). Example bottles: `/b/25A001/1`, `/b/25A003/1`.
Users: `agricoltore` (producer), `frantoio`, `laboratorio`, `imbottigliatore`; initial passwords come from the backend `.env`
and must be changed at first login (min 10 characters).
