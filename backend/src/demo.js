// Public "try the supply chain" mode: anyone can walk the four roles on a private PROVA-xxxx lot.
// Chain writes are paid by the server wallets, so everything here is capped (see config.js, `demo`).
import crypto from 'node:crypto';
import fs from 'node:fs';
import { ethers } from 'ethers';
import { ACTORS } from './config.js';
import { httpError } from './chain.js';

export const DEMO_ROLES = { agricoltore: 'PRODUTTORE', frantoio: 'FRANTOIO', laboratorio: 'LABORATORIO', imbottigliatore: 'IMBOTTIGLIATORE' };
export const CULTIVARS = ['Frantoio', 'Leccino', 'Moraiolo', 'Pendolino'];
export const ZONES = ['Chianti', "Val d'Orcia", 'Casentino', 'Valdarno', 'Maremma'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const err = (status, code, message, extra = {}) => Object.assign(httpError(status, message), { code }, extra);

/** Minimal one-page PDF with plain ASCII lines (sample lab report for the trial). */
export function samplePdf(lines) {
  const esc = (s) => s.replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, '\\$&');
  const stream = `BT /F1 13 Tf 50 780 Td 20 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`;
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
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function num(v, name, { min, max, dflt, int = false }) {
  if (v === undefined || v === null || v === '') return dflt;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) throw err(400, 'DEMO_BAD_INPUT', `${name} must be between ${min} and ${max}`);
  return n;
}

export function createDemo({ db, cfg, chain, svc }) {
  const d = cfg.demo;
  const now = cfg.now ?? Date.now;
  const day = () => new Date(now()).toISOString().slice(0, 10);
  const ipHash = (ip) => crypto.createHash('sha256').update(`${cfg.sessionSecret}|${ip}`).digest('hex').slice(0, 24);
  const userOf = (role) => ({ username: role, ruolo: DEMO_ROLES[role], wallet_address: chain.addressOf(DEMO_ROLES[role]) });

  // ---------- usage counters (persisted, per UTC day) ----------
  const runsOf = (ip) => db.prepare('SELECT runs FROM demo_runs WHERE day = ? AND ip_hash = ?').get(day(), ipHash(ip))?.runs ?? 0;
  const txToday = () => db.prepare('SELECT tx FROM demo_tx WHERE day = ?').get(day())?.tx ?? 0;
  const addUsage = (ip, runs, tx) => {
    db.prepare('INSERT INTO demo_runs (day, ip_hash, runs) VALUES (?,?,?) ON CONFLICT(day, ip_hash) DO UPDATE SET runs = MAX(0, runs + ?)').run(day(), ipHash(ip), Math.max(0, runs), runs);
    db.prepare('INSERT INTO demo_tx (day, tx) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET tx = MAX(0, tx + ?)').run(day(), Math.max(0, tx), tx);
  };

  // ---------- request rate limit per IP ----------
  const hits = new Map();
  const rate = (req, _res, next) => {
    const t = now();
    const arr = (hits.get(req.ip) ?? []).filter((x) => t - x < 60000);
    if (arr.length >= d.reqPerMin) {
      const wait = Math.max(1, Math.ceil((arr[0] + 60000 - t) / 1000));
      hits.set(req.ip, arr);
      return next(err(429, 'DEMO_RATE', 'Many requests in a short time, try again in a moment', { retryAfter: wait }));
    }
    arr.push(t);
    hits.set(req.ip, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => t - x < 60000)) hits.delete(k);
    next();
  };

  // ---------- wallet balances: pause the trial when an actor wallet runs low ----------
  let funds = { low: false, wallets: [], checkedAt: 0, since: null };
  const writeStatus = () => {
    try {
      fs.mkdirSync(cfg.dataDir, { recursive: true });
      fs.writeFileSync(d.statusFile, JSON.stringify({ lowFunds: funds.low, since: funds.since, minPol: d.minPol, wallets: funds.wallets, txToday: txToday(), txCap: d.txPerDay, updatedAt: new Date(now()).toISOString() }, null, 2));
    } catch (e) { console.error('[demo] cannot write status file:', e.message); }
  };
  async function checkFunds(force = false) {
    if (!chain.enabled || !chain.balanceOf) return true;
    if (!force && funds.checkedAt && now() - funds.checkedAt < d.balanceCacheSec * 1000) return !funds.low;
    try {
      const wallets = [];
      for (const a of ACTORS) wallets.push({ ruolo: a.ruolo, address: chain.addressOf(a.ruolo), pol: Number(ethers.formatEther(await chain.balanceOf(a.ruolo))) });
      const low = wallets.some((w) => w.pol < d.minPol);
      if (low && !funds.low) {
        funds.since = new Date(now()).toISOString();
        console.warn(`[demo] LOW FUNDS: ${wallets.filter((w) => w.pol < d.minPol).map((w) => `${w.ruolo}=${w.pol.toFixed(3)} POL`).join(', ')} (threshold ${d.minPol}). Trial mode paused: top up the wallet.`);
      }
      if (!low && funds.low) { console.warn('[demo] funds restored, trial mode resumed'); funds.since = null; }
      funds = { ...funds, low, wallets, checkedAt: now() };
      writeStatus();
    } catch (e) {
      funds.checkedAt = now(); // RPC trouble: keep the previous state, retry after the cache window
      console.error('[demo] balance check failed:', e.shortMessage || e.message);
    }
    return !funds.low;
  }
  const paused = () => err(503, 'DEMO_PAUSED', 'Trial mode is paused while the wallets are refilled');

  // ---------- helpers ----------
  const stepOf = (info) => (info ? (info.n_bottiglie > 0 ? 5 : Math.max(...info.fasi_completate) + 2) : 1);
  const sessionLot = (req) => {
    const code = req.session?.lot;
    if (!code) return null;
    const l = svc.getLotto(code);
    if (!l || !l.demo) { req.session.lot = null; return null; }
    return l;
  };
  const needEnabled = () => { if (!d.enabled) throw err(503, 'DEMO_DISABLED', 'Trial mode is switched off'); };
  const needRole = (req, role) => {
    if (req.session?.role !== role) throw err(403, 'DEMO_WRONG_ROLE', `Switch to the ${role} role first`);
  };
  const needLot = (req) => {
    const l = sessionLot(req);
    if (!l) throw err(409, 'DEMO_NO_LOT', 'Start with the harvest: it creates your trial lot');
    return l;
  };
  const randomCode = () => {
    for (let i = 0; i < 20; i++) {
      let c = 'PROVA-';
      for (let k = 0; k < 4; k++) c += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
      if (!svc.getLotto(c)) return c;
    }
    throw err(503, 'DEMO_PAUSED', 'Could not allocate a code');
  };

  async function statusInfo(req) {
    const ok = await checkFunds();
    const used = runsOf(req.ip);
    const txLeft = Math.max(0, d.txPerDay - txToday());
    let reason = null;
    if (!d.enabled) reason = 'disabled';
    else if (!ok) reason = 'lowFunds';
    else if (txLeft < d.txPerRun) reason = 'dailyCap';
    else if (used >= d.runsPerIpDay) reason = 'ipLimit';
    return { enabled: d.enabled, available: reason === null, reason, limits: { runsPerIpDay: d.runsPerIpDay, runsLeft: Math.max(0, d.runsPerIpDay - used), txPerDay: d.txPerDay, txLeft } };
  }

  async function me(req) {
    const l = sessionLot(req);
    const info = l ? svc.lottoInfo(l.codice) : null;
    return {
      active: !!l,
      role: req.session?.role ?? null,
      step: stepOf(info),
      totalSteps: 5,
      lotto: info,
      bottle_url: info && info.n_bottiglie > 0 ? `/b/${info.codice}/1` : null,
      status: await statusInfo(req),
    };
  }

  // ---------- actions ----------
  async function chooseRole(req) {
    needEnabled();
    const role = req.body?.role;
    if (!Object.hasOwn(DEMO_ROLES, role)) throw err(400, 'DEMO_BAD_INPUT', 'Unknown role');
    req.session = { ...(req.session ?? {}), role };
    return me(req);
  }

  async function creaLotto(req) {
    needEnabled();
    needRole(req, 'agricoltore');
    const b = req.body ?? {};
    const cultivar = b.cultivar ?? 'Frantoio';
    const zona = b.zona ?? 'Chianti';
    if (!CULTIVARS.includes(cultivar)) throw err(400, 'DEMO_BAD_INPUT', 'Unknown variety');
    if (!ZONES.includes(zona)) throw err(400, 'DEMO_BAD_INPUT', 'Unknown area');
    const kg = num(b.kg_olive, 'kg_olive', { min: 1, max: 5000, dflt: 500, int: true });
    if (runsOf(req.ip) >= d.runsPerIpDay) throw err(429, 'DEMO_IP_LIMIT', 'Daily trial paths for this connection are complete');
    if (txToday() + d.txPerRun > d.txPerDay) throw err(503, 'DEMO_DAILY_CAP', 'Daily trial transactions are complete');
    if (!(await checkFunds())) throw paused();
    const codice = randomCode();
    addUsage(req.ip, 1, d.txPerRun); // reserve before the (slow) chain call
    try {
      const out = await svc.creaLotto(userOf('agricoltore'), {
        codice, cultivar, zona, kg_olive: kg, data_raccolta: new Date(now()).toISOString().slice(0, 10),
        descrizione_en: `Harvest: ${cultivar}, ${zona}, ${kg} kg (trial lot)`,
      }, null, { demo: true });
      req.session = { ...req.session, lot: codice };
      return { ...out, step: 2, lotto: svc.lottoInfo(codice) };
    } catch (e) {
      addUsage(req.ip, -1, -d.txPerRun);
      throw e;
    }
  }

  async function mill(req) {
    needEnabled(); needRole(req, 'frantoio');
    const l = needLot(req);
    const t = num(req.body?.temperatura, 'temperatura', { min: 10, max: 35, dflt: 24 });
    const r = num(req.body?.resa, 'resa', { min: 5, max: 30, dflt: 14 });
    if (!(await checkFunds())) throw paused();
    const out = await svc.aggiungiPasso(userOf('frantoio'), l.codice, {
      fase: 1,
      descrizione: `Molitura a freddo: ${t} °C, resa ${r}%`,
      descrizione_en: `Cold milling: ${t} °C, yield ${r}%`,
    }, null);
    return { ...out, step: 3, lotto: svc.lottoInfo(l.codice) };
  }

  async function analysis(req) {
    needEnabled(); needRole(req, 'laboratorio');
    const l = needLot(req);
    const a = num(req.body?.acidita, 'acidita', { min: 0, max: 5, dflt: 0.2 });
    const p = num(req.body?.perossidi, 'perossidi', { min: 0, max: 50, dflt: 6 });
    if (!(await checkFunds())) throw paused();
    const buf = samplePdf(['PIETRE DI VITA - SAMPLE LAB REPORT (fictional data)', `Lot: ${l.codice}`, `Free acidity: ${a} %`, `Peroxides: ${p} meq O2/kg`, 'Result: extra virgin (trial exercise, no real value)']);
    const file = { buffer: buf, mimetype: 'application/pdf', originalname: `referto-${l.codice}.pdf`, size: buf.length };
    const out = await svc.aggiungiPasso(userOf('laboratorio'), l.codice, {
      fase: 2,
      descrizione: `Acidità ${a}%, perossidi ${p} meq O2/kg: extravergine`,
      descrizione_en: `Acidity ${a}%, peroxides ${p} meq O2/kg: extra virgin`,
    }, file);
    return { ...out, step: 4, lotto: svc.lottoInfo(l.codice) };
  }

  async function bottle(req) {
    needEnabled(); needRole(req, 'imbottigliatore');
    const l = needLot(req);
    const n = num(req.body?.n_bottiglie, 'n_bottiglie', { min: 1, max: 24, dflt: 12, int: true });
    if (!(await checkFunds())) throw paused();
    const out = await svc.imbottiglia(userOf('imbottigliatore'), l.codice, {
      n_bottiglie: n, descrizione: `Imbottigliate ${n} bottiglie`, descrizione_en: `${n} bottles filled`,
    }, null);
    return { ...out, step: 5, lotto: svc.lottoInfo(l.codice), bottle_url: `/b/${l.codice}/1` };
  }

  const reset = (req) => { req.session = { role: req.session?.role ?? null, lot: null }; return me(req); };

  let timer = null;
  if (chain.enabled && d.enabled) {
    timer = setInterval(() => { void checkFunds(true); }, 5 * 60 * 1000);
    timer.unref?.();
    void checkFunds(true);
  }

  return {
    rate, me, statusInfo, chooseRole, creaLotto, mill, analysis, bottle, reset, checkFunds,
    health: () => ({ enabled: d.enabled, lowFunds: funds.low, txToday: txToday(), txPerDay: d.txPerDay }),
    stop: () => timer && clearInterval(timer),
  };
}
