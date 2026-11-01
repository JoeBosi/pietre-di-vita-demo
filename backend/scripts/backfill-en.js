// One-off: fill the English columns of the demo lots 25B001..25B003 in the existing DB.
// Idempotent, DB only (never calls the chain). DB path comes from config (DB_PATH-less: <dataDir>/olio.db).
import 'dotenv/config';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import * as T from './demo-texts.js';

const LOTS = [
  { codice: '25B001', cultivar: 'Frantoio', zona: 'Colline del Chianti', kg: 1200 },
  { codice: '25B002', cultivar: 'Leccino', zona: 'Val di Chiana', kg: 900 },
  { codice: '25B003', cultivar: 'Moraiolo', zona: 'Colline del Chianti', kg: 800 },
];
const cfg = loadConfig(process.env, process.env.DATA_DIR ? { dataDir: process.env.DATA_DIR } : {});
const db = openDb(cfg.dbPath); // runs the migration too
console.log(`DB: ${cfg.dbPath}`);
const upd = db.prepare('UPDATE passi SET descrizione_en = ? WHERE lotto_codice = ? AND fase = ?');
let n = 0;
for (const L of LOTS) {
  const l = db.prepare('SELECT * FROM lotti WHERE codice = ?').get(L.codice);
  if (!l) { console.log(`skip ${L.codice} (not found)`); continue; }
  const texts = [T.harvestEn(L), T.millEn, T.analysisEn, T.bottlingEn(l.n_bottiglie)];
  texts.forEach((t, fase) => { n += Number(upd.run(t, L.codice, fase).changes); });
  if (l.richiamato && l.motivo_richiamo === T.RECALL_IT) {
    db.prepare('UPDATE lotti SET motivo_richiamo_en = ? WHERE codice = ?').run(T.RECALL_EN, L.codice);
    n += 1;
  }
  console.log(`ok ${L.codice}`);
}
console.log(`rows updated: ${n}`);
db.close();
