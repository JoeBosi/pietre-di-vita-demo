# QA browser (1 novembre 2026)

Playwright + Chrome di sistema, 390 px, 320 px e 1280 px, locale it-IT e en-US. Backend su una COPIA dei dati (porta 3812), contratto reale su Polygon Amoy, frontend con proxy `VITE_PROXY_TARGET`.

## Provato, esito
- Home, QR di esempio, link al lotto richiamato, selettore IT/EN, lingua del browser: ok.
- `/b/25B001/1`: bollino verde, 4 fasi con ✓ e link all'explorer, foto e PDF aprono. `/360` ok; `/361` e `/b/NOPE/1`: pagina 404 gentile. `/b/25B003/1`: banner rosso in alto.
- `/come-funziona`: 4 schede e sezione tecnica apribile: ok.
- `/filiera` con transazioni reali: agricoltore (cambio password, lotto 25Q900 con foto), frantoio (molitura), laboratorio (analisi, PDF obbligatorio), imbottigliatore (24 bottiglie), poi `/b/25Q900/24` verificata con 4 ✓ e `/b/25Q900/25` 404.
- Errori in italiano semplice: codice duplicato (da interfaccia). Ruolo sbagliato e ordine sbagliato verificati via API (il frontend li mappa); la UI non offre i pulsanti fuori turno.
- Richiamo: dialogo di conferma, annulla (si chiude), conferma (transazione), pagina con banner rosso.
- Confronto hash: ogni fase hashMatch true. Dopo modifica di un file su disco (copia temporanea) la pagina mostra "un documento non corrisponde" e ✗ sulla fase; file ripristinato, torna tutto true.
- 320 px: nessuno scroll orizzontale su `/`, `/b/...`, `/filiera`, `/come-funziona`.
- Console: nessun pageerror. Solo 401 su `/api/me` da non loggati e 404 volute (bottiglie inesistenti), che Chrome registra come errori di rete.

## Bug trovati e corretti
1. Backend `src/service.js`: il confronto hash usava l'impronta salvata nel DB, non il file su disco, quindi un file sostituito non veniva visto. Ora si ricalcola lo sha256 del file (campo `fileSha256`).
2. Frontend `Bottle.tsx`/`i18n.ts`: con un documento diverso il banner diceva "non ancora verificabile (modalità prova)". Ora c'è un avviso specifico (IT/EN).
3. Frontend `Layout.tsx`: il menu a 390 px andava a capo male ("Come funziona" spezzato); ora le voci non si spezzano.
4. Frontend `vite.config.ts`: bersaglio del proxy configurabile con `VITE_PROXY_TARGET`.

## Non provato / note
- Scansione del QR con la fotocamera di un telefono vero; altri browser (Safari iOS, Firefox).
- Analisi senza PDF: blocca già il browser ("Please select a file", testo nella lingua del browser); il rifiuto lato server non provato dall'interfaccia.
- Le descrizioni dei lotti di esempio (25B001...) sono in inglese anche nella pagina italiana: sono dati scritti sulla catena.
- Con `PUBLIC_BASE_URL` https il cookie di sessione è Secure: su http puro il login non resta (in produzione dietro Caddy va bene).


# QA modalità prova "Prova la filiera" (2 novembre 2026)
Playwright (Chromium headless) a 390 px e 1280 px, locale it-IT ed en-US. Backend NUOVO su 127.0.0.1:3892 con DB copia temporaneo, contratto e wallet reali di Polygon Amoy; frontend `vite` (dev) con `VITE_PROXY_TARGET`.
## Provato, esito
- Home, link secondario "Prova tu la filiera" / "Try the supply chain yourself" porta a `/filiera#prova`: ok.
- Percorso completo a 390 e 1280, IT ed EN (4 percorsi, tutti su transazioni vere): guida in 5 passi e schemino SVG visibili, contatore "Sei al passo X di 5" / "You are at step X of 5" a ogni passo (1..5), pulsante "Vai al Frantoio" ecc. dopo ogni passo, QR e pulsante "Apri la tua bottiglia", pagina `/b/PROVA-xxxx/1` con "Verificata" / "Verified", fase Analisi con "firma e documento corrispondono": ok. Nessun pageerror, nessuno scroll orizzontale.
- Percorso di circa 23-25 secondi (4 transazioni su Amoy).
- Con limite per IP raggiunto: messaggio "riprova domani" e link alla bottiglia di esempio. Con soglia fondi alzata sopra i saldi: "La modalità prova si sta ricaricando", `/api/health` con `lowFunds: true`, file `data/demo-status.json` scritto.
- Lotti PROVA assenti da `GET /api/lotti` (test backend).
## Bug trovato e corretto
- Con 30 richieste/minuto per IP due percorsi di fila bloccavano il secondo (429): il frontend ora riusa la risposta di `/api/demo/ruolo` e il default è 60 richieste/minuto.
## Non provato
- Telefono vero, Safari/Firefox, scansione del QR con la fotocamera. Nello screenshot a schermo intero il QR risulta ancora in caricamento (l'immagine risponde 200 image/png).
- Sessione demo dietro Caddy con https (cookie Secure) non provata: in locale su http://localhost.
