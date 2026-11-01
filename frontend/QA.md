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
