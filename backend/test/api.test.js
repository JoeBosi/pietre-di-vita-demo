import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import request from 'supertest';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const PW = { agricoltore: 'initial-agri-1', frantoio: 'initial-fran-1', laboratorio: 'initial-labo-1', imbottigliatore: 'initial-imbo-1' };

let ctx, dir;
const agents = {};

async function login(name) {
  const a = request.agent(ctx.app);
  await a.post('/api/login').send({ username: name, password: PW[name] }).expect(200);
  await a.post('/api/cambia-password').send({ vecchia: PW[name], nuova: 'a-brand-new-pass-1' }).expect(200);
  return a;
}

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'olio-test-'));
  const env = {
    INITIAL_PASSWORD_AGRICOLTORE: PW.agricoltore, INITIAL_PASSWORD_FRANTOIO: PW.frantoio,
    INITIAL_PASSWORD_LABORATORIO: PW.laboratorio, INITIAL_PASSWORD_IMBOTTIGLIATORE: PW.imbottigliatore,
    SESSION_SECRET: 'test', PUBLIC_BASE_URL: 'http://localhost:5174',
  };
  ctx = createApp(loadConfig(env, { dataDir: dir, forceOffline: true }));
  for (const n of Object.keys(PW)) agents[n] = await login(n);
});
after(() => { ctx.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test('health reports offline mode', async () => {
  const r = await request(ctx.app).get('/api/health').expect(200);
  assert.equal(r.body.offline, true);
});

test('login, me, logout, bad credentials, forced password change', async () => {
  await request(ctx.app).post('/api/login').send({ username: 'frantoio', password: 'nope' }).expect(401);
  await request(ctx.app).get('/api/me').expect(401);
  const a = request.agent(ctx.app);
  await a.post('/api/login').send({ username: 'laboratorio', password: 'a-brand-new-pass-1' }).expect(200);
  const me = await a.get('/api/me').expect(200);
  assert.equal(me.body.user.ruolo, 'LABORATORIO');
  await a.post('/api/logout').expect(200);
  await a.get('/api/me').expect(401);
  // a fresh user must change the password before writing
  ctx.db.prepare('UPDATE users SET must_change_password = 1 WHERE username = ?').run('laboratorio');
  const b = request.agent(ctx.app);
  await b.post('/api/login').send({ username: 'laboratorio', password: 'a-brand-new-pass-1' }).expect(200);
  const r = await b.post('/api/lotti/X/passi').field('fase', '2').expect(403);
  assert.equal(r.body.code, 'MUST_CHANGE_PASSWORD');
  ctx.db.prepare('UPDATE users SET must_change_password = 0 WHERE username = ?').run('laboratorio');
});

test('only the producer creates lots; duplicate codes rejected', async () => {
  const body = { codice: 'T001', cultivar: 'Frantoio', zona: 'Test', data_raccolta: '2025-10-20', kg_olive: '500' };
  await agents.frantoio.post('/api/lotti').field(body).expect(403);
  const r = await agents.agricoltore.post('/api/lotti').field(body).attach('photo', PNG, { filename: 'p.png', contentType: 'image/png' }).expect(200);
  assert.equal(r.body.offline, true);
  assert.equal(r.body.tx_hash, null);
  await agents.agricoltore.post('/api/lotti').field(body).expect(409);
});

test('role and phase order enforcement', async () => {
  const f = agents.frantoio, l = agents.laboratorio, i = agents.imbottigliatore, p = agents.agricoltore;
  // frantoio cannot do Analisi
  await f.post('/api/lotti/T001/passi').field({ fase: '2', descrizione: 'x' }).attach('file', PDF, { filename: 'r.pdf', contentType: 'application/pdf' }).expect(403);
  // Analisi before Molitura rejected (order)
  await l.post('/api/lotti/T001/passi').field({ fase: '2', descrizione: 'x' }).attach('file', PDF, { filename: 'r.pdf', contentType: 'application/pdf' }).expect(409);
  // Imbottigliamento before Analisi rejected, both endpoints
  await i.post('/api/lotti/T001/imbottiglia').field({ n_bottiglie: '10' }).expect(409);
  await i.post('/api/lotti/T001/passi').field({ fase: '3', n_bottiglie: '10' }).expect(409);
  await f.post('/api/lotti/T001/passi').field({ fase: '1', descrizione: 'milled' }).attach('file', PNG, { filename: 'm.png', contentType: 'image/png' }).expect(200);
  // repeating Molitura is out of order
  await f.post('/api/lotti/T001/passi').field({ fase: '1', descrizione: 'again' }).expect(409);
  // lab report is mandatory
  await l.post('/api/lotti/T001/passi').field({ fase: '2', descrizione: 'x' }).expect(400);
  await l.post('/api/lotti/T001/passi').field({ fase: '2', descrizione: 'acidity ok' }).attach('file', PDF, { filename: 'r.pdf', contentType: 'application/pdf' }).expect(200);
  await p.post('/api/lotti/T001/richiamo').send({ motivo: '' }).expect(400);
  await i.post('/api/lotti/T001/richiamo').send({ motivo: 'x' }).expect(403);
  await i.post('/api/lotti/T001/imbottiglia').field({ n_bottiglie: '10', descrizione: 'bottled' }).attach('file', PNG, { filename: 'l.png', contentType: 'image/png' }).expect(200);
  await i.post('/api/lotti/T001/imbottiglia').field({ n_bottiglie: '10' }).expect(409);
});

test('upload validation: type and size', async () => {
  await agents.agricoltore.post('/api/lotti').field({ codice: 'T002', cultivar: 'a', zona: 'b', data_raccolta: '2025-10-20', kg_olive: '5' })
    .attach('photo', Buffer.from('hello'), { filename: 'x.txt', contentType: 'text/plain' }).expect(400);
  // mime lie: PDF content declared as PNG
  await agents.agricoltore.post('/api/lotti').field({ codice: 'T002', cultivar: 'a', zona: 'b', data_raccolta: '2025-10-20', kg_olive: '5' })
    .attach('photo', PDF, { filename: 'x.png', contentType: 'image/png' }).expect(400);
  const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
  await agents.agricoltore.post('/api/lotti').field({ codice: 'T002', cultivar: 'a', zona: 'b', data_raccolta: '2025-10-20', kg_olive: '5' })
    .attach('photo', big, { filename: 'big.png', contentType: 'image/png' }).expect(413);
  assert.equal(ctx.svc.getLotto('T002'), undefined);
});

test('document sha256 is computed by the server and file is served', async () => {
  const r = await request(ctx.app).get('/api/pubblico/lotto/T001').expect(200);
  const analisi = r.body.passi.find((p) => p.fase === 2);
  assert.equal(analisi.documento.sha256, crypto.createHash('sha256').update(PDF).digest('hex'));
  const doc = await request(ctx.app).get(analisi.documento.url).expect(200);
  assert.equal(doc.headers['content-type'].startsWith('application/pdf'), true);
  assert.deepEqual(r.body.passi.map((p) => p.fase), [0, 1, 2, 3]);
  assert.equal(r.body.verifica.onchain, false);
});

test('bottle verification range, QR, recall', async () => {
  await request(ctx.app).get('/api/pubblico/bottiglia/T001/0').expect(404);
  await request(ctx.app).get('/api/pubblico/bottiglia/T001/11').expect(404);
  await request(ctx.app).get('/api/pubblico/bottiglia/NOPE/1').expect(404);
  const ok = await request(ctx.app).get('/api/pubblico/bottiglia/T001/10').expect(200);
  assert.deepEqual(ok.body.bottiglia, { numero: 10, di: 10 });
  assert.equal(ok.body.lotto.richiamato, false);
  const qr = await request(ctx.app).get('/api/qr/T001/3.png').expect(200);
  assert.equal(qr.headers['content-type'], 'image/png');
  assert.equal(qr.body.subarray(1, 4).toString(), 'PNG');
  await agents.agricoltore.post('/api/lotti/T001/richiamo').send({ motivo: 'test recall' }).expect(200);
  const rec = await request(ctx.app).get('/api/pubblico/bottiglia/T001/1').expect(200);
  assert.equal(rec.body.lotto.richiamato, true);
  assert.equal(rec.body.lotto.motivo_richiamo, 'test recall');
  await agents.frantoio.post('/api/lotti/T001/passi').field({ fase: '1', descrizione: 'x' }).expect(409);
});

test('lots list requires login', async () => {
  await request(ctx.app).get('/api/lotti').expect(401);
  const r = await agents.frantoio.get('/api/lotti').expect(200);
  assert.equal(r.body.lotti.length, 1);
});

// ---- login rate limiting (own app instance, fake clock) ----
async function limiterCtx() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'olio-rl-'));
  const clock = { t: 1_800_000_000_000 };
  const env = {
    INITIAL_PASSWORD_AGRICOLTORE: PW.agricoltore, INITIAL_PASSWORD_FRANTOIO: PW.frantoio,
    INITIAL_PASSWORD_LABORATORIO: PW.laboratorio, INITIAL_PASSWORD_IMBOTTIGLIATORE: PW.imbottigliatore, SESSION_SECRET: 'test',
  };
  const cfg = { ...loadConfig(env, { dataDir: d, forceOffline: true }), now: () => clock.t };
  const c = createApp(cfg);
  const post = (user, pass, ip = '1.1.1.1') =>
    request(c.app).post('/api/login').set('X-Forwarded-For', ip).send({ username: user, password: pass });
  return { c, clock, post, done: () => { c.close(); fs.rmSync(d, { recursive: true, force: true }); } };
}

test('rate limit: 5 failures block even the correct password, then 15 min later it works', async () => {
  const { clock, post, done } = await limiterCtx();
  try {
    for (let i = 0; i < 5; i++) await post('frantoio', 'wrong').expect(401);
    const r = await post('frantoio', PW.frantoio).expect(429);
    assert.equal(r.body.code, 'TOO_MANY_ATTEMPTS');
    assert.equal(r.body.retry_after_seconds, 900);
    assert.equal(r.headers['retry-after'], '900');
    clock.t += 14 * 60 * 1000;
    const r2 = await post('frantoio', PW.frantoio).expect(429);
    assert.equal(r2.body.retry_after_seconds, 60);
    clock.t += 60 * 1000;
    await post('frantoio', PW.frantoio).expect(200);
  } finally { done(); }
});

test('rate limit: window counts from the last failure and success resets', async () => {
  const { clock, post, done } = await limiterCtx();
  try {
    for (let i = 0; i < 4; i++) await post('frantoio', 'wrong').expect(401);
    await post('frantoio', PW.frantoio).expect(200); // success clears the key
    for (let i = 0; i < 4; i++) await post('frantoio', 'wrong').expect(401);
    await post('frantoio', 'wrong').expect(401); // 5th
    await post('frantoio', PW.frantoio).expect(429);
    // failures older than 15 minutes do not accumulate
    clock.t += 16 * 60 * 1000;
    await post('frantoio', 'wrong').expect(401);
    await post('frantoio', PW.frantoio).expect(200);
  } finally { done(); }
});

test('rate limit: keys per ip and username are independent', async () => {
  const { post, done } = await limiterCtx();
  try {
    for (let i = 0; i < 5; i++) await post('frantoio', 'wrong', '1.1.1.1').expect(401);
    await post('frantoio', PW.frantoio, '1.1.1.1').expect(429);
    await post('frantoio', PW.frantoio, '2.2.2.2').expect(200); // other IP
    await post('laboratorio', PW.laboratorio, '1.1.1.1').expect(200); // other username
  } finally { done(); }
});

test('rate limit: unknown username behaves like a wrong password', async () => {
  const { post, done } = await limiterCtx();
  try {
    for (let i = 0; i < 5; i++) await post('nessuno', 'wrong').expect(401);
    const r = await post('nessuno', 'wrong').expect(429);
    assert.equal(r.body.code, 'TOO_MANY_ATTEMPTS');
    assert.equal(r.body.retry_after_seconds, 900);
  } finally { done(); }
});

test('rate limit: per-IP cap of 30 failures across usernames', async () => {
  const { post, done } = await limiterCtx();
  try {
    for (let i = 0; i < 30; i++) await post(`user${i}`, 'wrong', '9.9.9.9').expect(401);
    await post('frantoio', PW.frantoio, '9.9.9.9').expect(429);
    await post('frantoio', PW.frantoio, '8.8.8.8').expect(200);
  } finally { done(); }
});

test('rate limit: wrong old password on cambia-password is limited too', async () => {
  const { c, post, done } = await limiterCtx();
  try {
    const a = request.agent(c.app);
    await a.post('/api/login').set('X-Forwarded-For', '3.3.3.3').send({ username: 'frantoio', password: PW.frantoio }).expect(200);
    for (let i = 0; i < 5; i++) await a.post('/api/cambia-password').set('X-Forwarded-For', '3.3.3.3').send({ vecchia: 'bad', nuova: 'a-brand-new-pass-1' }).expect(401);
    const r = await a.post('/api/cambia-password').set('X-Forwarded-For', '3.3.3.3').send({ vecchia: PW.frantoio, nuova: 'a-brand-new-pass-1' }).expect(429);
    assert.equal(r.body.code, 'TOO_MANY_ATTEMPTS');
    void post;
  } finally { done(); }
});

test('bilingual: English texts are stored and exposed, absent ones are null', async () => {
  const a = agents.agricoltore;
  await a.post('/api/lotti').field('codice', 'EN001').field('cultivar', 'Frantoio').field('zona', 'Chianti').field('data_raccolta', '2025-10-18').field('kg_olive', '100').expect(200);
  await agents.frantoio.post('/api/lotti/EN001/passi').field('fase', '1').field('descrizione', 'Molitura veloce').field('descrizione_en', 'Quick milling').expect(200);
  await a.post('/api/lotti/EN001/richiamo').send({ motivo: 'Difetto', motivo_en: 'Defect' }).expect(200);
  const r = await request(ctx.app).get('/api/pubblico/lotto/EN001').expect(200);
  assert.equal(r.body.passi[0].descrizione_en, 'Harvest: Frantoio, Chianti, 100 kg');
  assert.equal(r.body.passi[1].descrizione, 'Molitura veloce');
  assert.equal(r.body.passi[1].descrizione_en, 'Quick milling');
  assert.equal(r.body.lotto.motivo_richiamo_en, 'Defect');
  await a.post('/api/lotti').field('codice', 'EN002').field('cultivar', 'X').field('zona', 'Y').field('data_raccolta', '2025-10-18').field('kg_olive', '5').expect(200);
  await a.post('/api/lotti/EN002/richiamo').send({ motivo: 'Solo italiano' }).expect(200);
  const r2 = await request(ctx.app).get('/api/pubblico/lotto/EN002').expect(200);
  assert.equal(r2.body.lotto.motivo_richiamo_en, null);
});

test('migration adds English columns to an old database, idempotently', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { openDb } = await import('../src/db.js');
  const f = path.join(dir, 'old.db');
  const old = new DatabaseSync(f);
  old.exec('CREATE TABLE passi (id INTEGER PRIMARY KEY, lotto_codice TEXT, fase INTEGER, descrizione TEXT NOT NULL, attore_username TEXT, attore_address TEXT, timestamp INTEGER, doc_id INTEGER, tx_hash TEXT); CREATE TABLE lotti (codice TEXT PRIMARY KEY, motivo_richiamo TEXT);');
  old.close();
  openDb(f).close();
  const db2 = openDb(f);
  assert.ok(db2.prepare('PRAGMA table_info(passi)').all().some((c) => c.name === 'descrizione_en'));
  assert.ok(db2.prepare('PRAGMA table_info(lotti)').all().some((c) => c.name === 'motivo_richiamo_en'));
  db2.close();
});
