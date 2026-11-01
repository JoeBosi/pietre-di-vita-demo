// Idempotent seed: 4 actors + 3 fictional lots (harvest 2025), lot 3 recalled.
// On-chain when RPC/keys are configured and ../contracts/deployments/<network>.json exists, DB only otherwise.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { loadConfig, ROOT } from '../src/config.js';
import { createApp } from '../src/app.js';

function crc32(buf) {
  let c, crc = ~0;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** Tiny solid-colour PNG (64x64), unique per colour so hashes differ. */
function png([r, g, b]) {
  const w = 64, h = 64;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function pdf(lines) {
  const stream = 'BT /F1 12 Tf 50 740 Td 16 TL ' + lines.map((l) => `(${l.replace(/[()\\]/g, '')}) Tj T*`).join(' ') + ' ET';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
const file = (buffer, mimetype, originalname) => ({ buffer, mimetype, originalname, size: buffer.length });
const img = (name, rgb) => file(png(rgb), 'image/png', name);

const LOTS = [
  { codice: '25A001', cultivar: 'Frantoio', zona: 'Colline del Chianti', data: '2025-10-18', kg: 1200, bottles: 360, rgb: [96, 120, 60] },
  { codice: '25A002', cultivar: 'Leccino', zona: 'Val di Chiana', data: '2025-10-25', kg: 900, bottles: 270, rgb: [120, 140, 70] },
  { codice: '25A003', cultivar: 'Moraiolo', zona: 'Colline del Chianti', data: '2025-11-02', kg: 800, bottles: 240, rgb: [80, 100, 50], recall: 'Possible bottle-cap defect found during a routine check' },
];

const network = process.env.NETWORK || 'amoy';
const depFile = path.join(ROOT, '..', 'contracts', 'deployments', `${network}.json`);
const overrides = {};
const env = { ...process.env };
let note = '';
if (env.RPC_URL) {
  if (fs.existsSync(depFile)) {
    const dep = JSON.parse(fs.readFileSync(depFile, 'utf8'));
    env.CONTRACT_ADDRESS ||= dep.contract || dep.address || dep.contractAddress || dep.PietreDiVita?.address || dep.contracts?.PietreDiVita?.address || '';
  } else {
    note = `RPC configured but ${path.relative(ROOT, depFile)} not found: seeding DB only (offline).`;
    overrides.forceOffline = true;
  }
}
const cfg = loadConfig(env, overrides);
const { db, chain, svc, close } = createApp(cfg);
console.log(chain.enabled ? 'Seeding on-chain' : `Seeding offline (DB only). ${note}`);

const user = (name) => db.prepare('SELECT * FROM users WHERE username = ?').get(name);
for (const [i, L] of LOTS.entries()) {
  if (svc.getLotto(L.codice)) { console.log(`skip ${L.codice} (exists)`); continue; }
  await svc.creaLotto(user('agricoltore'), { codice: L.codice, cultivar: L.cultivar, zona: L.zona, data_raccolta: L.data, kg_olive: L.kg }, img(`${L.codice}-harvest.png`, L.rgb));
  await svc.aggiungiPasso(user('frantoio'), L.codice, { fase: 1, descrizione: `Milled within 12 h, paste at 24 C, yield 14%` }, img(`${L.codice}-mill.png`, L.rgb.map((v) => v + 30)));
  await svc.aggiungiPasso(user('laboratorio'), L.codice, { fase: 2, descrizione: 'Acidity 0.2%, peroxides 7 meq O2/kg: extra virgin' },
    file(pdf([`Lab report - lot ${L.codice}`, 'Fictional demo data', 'Acidity: 0.2 %', 'Peroxides: 7 meq O2/kg', 'Result: extra virgin']), 'application/pdf', `${L.codice}-report.pdf`));
  await svc.imbottiglia(user('imbottigliatore'), L.codice, { n_bottiglie: L.bottles, descrizione: `Bottled ${L.bottles} bottles, label photo attached` }, img(`${L.codice}-label.png`, L.rgb.map((v) => v + 60)));
  if (L.recall) await svc.richiama(user('agricoltore'), L.codice, { motivo: L.recall });
  console.log(`seeded ${L.codice}${L.recall ? ' (recalled)' : ''}`);
}
close();
