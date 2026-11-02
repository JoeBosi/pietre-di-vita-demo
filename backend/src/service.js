import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { FASI, FASE_RUOLO } from './config.js';
import { httpError, toBytes32 } from './chain.js';

const CODE_RE = /^[A-Za-z0-9_-]{1,32}$/;
const MIME_EXT = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };

export function sniffMime(buf) {
  if (buf.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

export function parseDate(v) {
  if (v === undefined || v === null || v === '') throw httpError(400, 'data_raccolta is required');
  if (/^\d{9,11}$/.test(String(v))) return Number(v);
  const t = Date.parse(String(v));
  if (Number.isNaN(t)) throw httpError(400, 'data_raccolta must be a date (YYYY-MM-DD) or unix seconds');
  return Math.floor(t / 1000);
}

function posInt(v, name, max = 4294967295) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > max) throw httpError(400, `${name} must be a positive integer`);
  return n;
}

function optText(v, name, max = 1000) {
  if (v === undefined || v === null || v === '') return null;
  return text(v, name, max);
}

function text(v, name, max = 500) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) throw httpError(400, `${name} is required`);
  if (s.length > max) throw httpError(400, `${name} is too long`);
  return s;
}

export function createService({ db, cfg, chain }) {
  fs.mkdirSync(cfg.uploadDir, { recursive: true });

  const getLotto = (codice) => db.prepare('SELECT * FROM lotti WHERE codice = ?').get(codice);
  const needLotto = (codice) => {
    const l = getLotto(codice);
    if (!l) throw httpError(404, 'Lot not found');
    return l;
  };
  const passiOf = (codice) => db.prepare('SELECT * FROM passi WHERE lotto_codice = ? ORDER BY id').all(codice);

  /** Validate and store an uploaded file (memory buffer). Returns a document row or null. */
  function storeFile(codice, fase, file) {
    if (!file) return null;
    const mime = sniffMime(file.buffer);
    if (!mime || !MIME_EXT[file.mimetype] || file.mimetype !== mime) {
      throw httpError(400, 'Only pdf, jpg and png files are accepted');
    }
    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const stored = `${crypto.randomUUID()}${MIME_EXT[mime]}`;
    const full = path.join(cfg.uploadDir, stored);
    fs.writeFileSync(full, file.buffer);
    const filename = path.basename(file.originalname || `file${MIME_EXT[mime]}`).slice(0, 120);
    return { lotto_codice: codice, fase, filename, stored_path: stored, sha256, mime, size: file.size, full };
  }
  const insertDoc = (d) =>
    Number(
      db
        .prepare('INSERT INTO documenti (lotto_codice,fase,filename,stored_path,sha256,mime,size) VALUES (?,?,?,?,?,?,?)')
        .run(d.lotto_codice, d.fase, d.filename, d.stored_path, d.sha256, d.mime, d.size).lastInsertRowid,
    );
  const dropFile = (d) => d && fs.rmSync(d.full, { force: true });

  function insertPasso(codice, fase, descrizione, user, docId, txHash, descrizioneEn = null) {
    db.prepare(
      'INSERT INTO passi (lotto_codice,fase,descrizione,attore_username,attore_address,timestamp,doc_id,tx_hash,descrizione_en) VALUES (?,?,?,?,?,?,?,?,?)',
    ).run(codice, fase, descrizione, user.username, user.wallet_address ?? chain.addressOf(user.ruolo), Math.floor(Date.now() / 1000), docId, txHash, descrizioneEn);
  }

  const result = (extra) => ({ ok: true, offline: !chain.enabled, ...extra });

  /** Run the on-chain call first; DB is only written when it succeeded. */
  async function guarded(doc, fn) {
    try {
      return await fn();
    } catch (e) {
      dropFile(doc);
      if (e.status) throw e;
      throw httpError(502, `Chain transaction failed: ${e.shortMessage || e.message}`);
    }
  }

  async function creaLotto(user, body, file, opts = {}) {
    if (user.ruolo !== 'PRODUTTORE') throw httpError(403, 'Only the producer can create lots');
    const l = {
      codice: text(body.codice, 'codice', 32),
      cultivar: text(body.cultivar, 'cultivar', 100),
      zona: text(body.zona, 'zona', 100),
      data_raccolta: parseDate(body.data_raccolta),
      kg_olive: posInt(body.kg_olive, 'kg_olive'),
    };
    if (!CODE_RE.test(l.codice)) throw httpError(400, 'codice may only contain letters, digits, - and _');
    // PROVA-* is reserved for the public trial mode.
    if (!opts.demo && /^prova-/i.test(l.codice)) throw httpError(400, 'Codes starting with PROVA- are reserved for the trial mode');
    if (getLotto(l.codice)) throw httpError(409, 'Lot code already exists');
    const doc = storeFile(l.codice, 0, file);
    const out = await guarded(doc, async () => {
      if (!chain.enabled) return { txHash: null, tokenId: null };
      return chain.creaLotto(user.ruolo, l, toBytes32(doc?.sha256));
    });
    db.prepare(
      'INSERT INTO lotti (codice,token_id,cultivar,zona,data_raccolta,kg_olive,tx_create,demo) VALUES (?,?,?,?,?,?,?,?)',
    ).run(l.codice, out.tokenId, l.cultivar, l.zona, l.data_raccolta, l.kg_olive, out.txHash, opts.demo ? 1 : 0);
    const docId = doc ? insertDoc(doc) : null;
    insertPasso(l.codice, 0, `Raccolta: ${l.cultivar}, ${l.zona}, ${l.kg_olive} kg`, user, docId, out.txHash,
      body.descrizione_en ? optText(body.descrizione_en, 'descrizione_en') : `Harvest: ${l.cultivar}, ${l.zona}, ${l.kg_olive} kg`);
    return result({ codice: l.codice, token_id: out.tokenId, tx_hash: out.txHash });
  }

  /** Common checks for adding a phase: role, order, recall status. */
  function checkFase(user, lotto, fase) {
    if (!Number.isInteger(fase) || fase < 1 || fase > 4) throw httpError(400, 'fase must be 1..4 (Raccolta is created with the lot)');
    if (FASE_RUOLO[fase] !== user.ruolo) {
      throw httpError(403, `Phase ${FASI[fase]} can only be registered by ${FASE_RUOLO[fase]}`);
    }
    if (lotto.richiamato) throw httpError(409, 'Lot has been recalled');
    const done = passiOf(lotto.codice).map((p) => p.fase);
    const expected = Math.max(...done) + 1;
    if (fase !== expected) {
      throw httpError(409, `Wrong phase order: expected ${FASI[expected] ?? 'nothing more'}, got ${FASI[fase]}`);
    }
  }

  async function aggiungiPasso(user, codice, body, file) {
    const lotto = needLotto(codice);
    const fase = Number(body.fase);
    if (fase === 3) return imbottiglia(user, codice, { n_bottiglie: body.n_bottiglie, descrizione: body.descrizione, descrizione_en: body.descrizione_en }, file);
    checkFase(user, lotto, fase);
    const descrizione = text(body.descrizione, 'descrizione', 1000);
    const descEn = optText(body.descrizione_en, 'descrizione_en');
    if (fase === 2 && !file) throw httpError(400, 'The lab report (pdf) is required for Analisi');
    const doc = storeFile(codice, fase, file);
    const out = await guarded(doc, async () => {
      if (!chain.enabled) return { txHash: null };
      if (!lotto.token_id) throw httpError(409, 'Lot has no token (it was created offline)');
      const r = await chain.aggiungiPasso(user.ruolo, lotto.token_id, fase, descrizione, toBytes32(doc?.sha256));
      return { txHash: r.txHash };
    });
    const docId = doc ? insertDoc(doc) : null;
    insertPasso(codice, fase, descrizione, user, docId, out.txHash, descEn);
    return result({ fase, tx_hash: out.txHash, documento_sha256: doc?.sha256 ?? null });
  }

  async function imbottiglia(user, codice, body, file) {
    const lotto = needLotto(codice);
    checkFase(user, lotto, 3);
    const n = posInt(body.n_bottiglie, 'n_bottiglie');
    if (lotto.n_bottiglie > 0) throw httpError(409, 'Bottles already fixed for this lot');
    const doc = storeFile(codice, 3, file);
    const out = await guarded(doc, async () => {
      if (!chain.enabled) return { txHash: null };
      if (!lotto.token_id) throw httpError(409, 'Lot has no token (it was created offline)');
      return chain.imbottiglia(user.ruolo, lotto.token_id, n, toBytes32(doc?.sha256));
    });
    db.prepare('UPDATE lotti SET n_bottiglie = ? WHERE codice = ?').run(n, codice);
    const docId = doc ? insertDoc(doc) : null;
    insertPasso(codice, 3, (body.descrizione || '').trim() || `Bottled: ${n} bottles`, user, docId, out.txHash, optText(body.descrizione_en, 'descrizione_en'));
    return result({ fase: 3, n_bottiglie: n, tx_hash: out.txHash, documento_sha256: doc?.sha256 ?? null });
  }

  async function richiama(user, codice, body) {
    if (user.ruolo !== 'PRODUTTORE') throw httpError(403, 'Only the producer can recall a lot');
    const lotto = needLotto(codice);
    if (lotto.richiamato) throw httpError(409, 'Lot already recalled');
    const motivo = text(body.motivo, 'motivo', 1000);
    const motivoEn = optText(body.motivo_en, 'motivo_en');
    const out = await guarded(null, async () => {
      if (!chain.enabled) return { txHash: null };
      if (!lotto.token_id) throw httpError(409, 'Lot has no token (it was created offline)');
      return chain.richiama(user.ruolo, lotto.token_id, motivo);
    });
    db.prepare('UPDATE lotti SET richiamato = 1, motivo_richiamo = ?, motivo_richiamo_en = ? WHERE codice = ?').run(motivo, motivoEn, codice);
    return result({ richiamato: true, tx_hash: out.txHash });
  }

  const txUrl = (h) => (h ? `${chain.explorerBase}/tx/${h}` : null);

  function lottoView(l) {
    return {
      codice: l.codice,
      token_id: l.token_id,
      cultivar: l.cultivar,
      zona: l.zona,
      data_raccolta: l.data_raccolta,
      kg_olive: l.kg_olive,
      n_bottiglie: l.n_bottiglie,
      richiamato: !!l.richiamato,
      motivo_richiamo: l.motivo_richiamo,
      motivo_richiamo_en: l.motivo_richiamo_en ?? null,
      tx_create: l.tx_create,
      tx_create_url: txUrl(l.tx_create),
      fasi_completate: passiOf(l.codice).map((p) => p.fase),
    };
  }

  function passiView(codice) {
    return passiOf(codice).map((p) => {
      const d = p.doc_id ? db.prepare('SELECT * FROM documenti WHERE id = ?').get(p.doc_id) : null;
      return {
        fase: p.fase,
        fase_nome: FASI[p.fase],
        descrizione: p.descrizione,
        descrizione_en: p.descrizione_en ?? null,
        attore: p.attore_username,
        attore_address: p.attore_address,
        timestamp: p.timestamp,
        tx_hash: p.tx_hash,
        tx_url: txUrl(p.tx_hash),
        documento: d && { id: d.id, filename: d.filename, mime: d.mime, size: d.size, sha256: d.sha256, url: `/api/documenti/${d.id}` },
      };
    });
  }

  async function verifica(lotto, passi) {
    const out = { onchain: chain.enabled, esiste: null, richiamato: null, hashMatch: [], explorerBase: chain.explorerBase };
    if (!chain.enabled) return { ...out, note: 'Backend in offline mode: nothing to compare against a chain' };
    try {
      const c = await chain.leggi(lotto.codice);
      out.esiste = c.esiste;
      if (!c.esiste) return out;
      out.richiamato = c.richiamato;
      out.hashMatch = passi.map((p, i) => {
        if (!p.documento) return null;
        const onchainHash = c.passi[i]?.docHash ?? null;
        // Hash the file actually stored on disk (not the value saved in the DB), so a swapped file is detected.
        let fileSha = null;
        try {
          const row = db.prepare('SELECT stored_path FROM documenti WHERE id = ?').get(p.documento.id);
          fileSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(cfg.uploadDir, path.basename(row.stored_path)))).digest('hex');
        } catch { /* missing file: treated as mismatch */ }
        return {
          fase: p.fase,
          documento_id: p.documento.id,
          dbSha256: p.documento.sha256,
          fileSha256: fileSha,
          onchainHash,
          match: !!onchainHash && !!fileSha && fileSha === p.documento.sha256 && onchainHash.toLowerCase() === '0x' + fileSha,
        };
      }).filter(Boolean);
      out.statoCoerente = c.richiamato === !!lotto.richiamato && c.passi.length === passi.length;
    } catch (e) {
      out.errore = `Chain read failed: ${e.shortMessage || e.message}`;
    }
    return out;
  }

  async function pubblicoLotto(codice) {
    const lotto = needLotto(codice);
    const passi = passiView(codice);
    return { lotto: lottoView(lotto), passi, verifica: await verifica(lotto, passi), offline: !chain.enabled };
  }

  async function pubblicoBottiglia(codice, n) {
    const lotto = needLotto(codice);
    const num = Number(n);
    if (!Number.isInteger(num) || num < 1 || num > lotto.n_bottiglie) {
      throw httpError(404, `Bottle not found: lot ${codice} has ${lotto.n_bottiglie} bottles`);
    }
    return { bottiglia: { numero: num, di: lotto.n_bottiglie }, ...(await pubblicoLotto(codice)) };
  }

  function listLotti() {
    return db.prepare('SELECT codice FROM lotti WHERE demo = 0 ORDER BY rowid').all().map((r) => lottoView(getLotto(r.codice)));
  }

  return { creaLotto, aggiungiPasso, imbottiglia, richiama, pubblicoLotto, pubblicoBottiglia, listLotti, getLotto, lottoInfo: (codice) => lottoView(needLotto(codice)) };
}
