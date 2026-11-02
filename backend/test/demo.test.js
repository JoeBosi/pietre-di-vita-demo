import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { samplePdf } from '../src/demo.js';

const PW = { INITIAL_PASSWORD_AGRICOLTORE: 'initial-agri-1', INITIAL_PASSWORD_FRANTOIO: 'initial-fran-1', INITIAL_PASSWORD_LABORATORIO: 'initial-labo-1', INITIAL_PASSWORD_IMBOTTIGLIATORE: 'initial-imbo-1' };
const POL = 10n ** 18n;

/** In-memory chain double: counts transactions, balances are settable. */
function fakeChain() {
  const c = {
    enabled: true, explorerBase: 'https://explorer.test', txs: 0, ids: new Map(), balances: { PRODUTTORE: 5n * POL, FRANTOIO: 5n * POL, LABORATORIO: 5n * POL, IMBOTTIGLIATORE: 5n * POL },
    addressOf: (r) => `0x${r}`,
    balanceOf: async (r) => c.balances[r],
    creaLotto: async (_r, l) => { c.txs++; c.ids.set(l.codice, String(c.ids.size + 1)); return { txHash: `0xtx${c.txs}`, tokenId: String(c.ids.size) }; },
    aggiungiPasso: async () => ({ txHash: `0xtx${++c.txs}` }),
    imbottiglia: async () => ({ txHash: `0xtx${++c.txs}` }),
    richiama: async () => ({ txHash: `0xtx${++c.txs}` }),
    leggi: async () => ({ esiste: true, id: '1', richiamato: false, nBottiglie: 0, passi: [] }),
  };
  return c;
}

function setup(demo = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'olio-demo-'));
  const clock = { t: Date.parse('2026-11-02T10:00:00Z') };
  const chain = fakeChain();
  const cfg = { ...loadConfig({ ...PW, SESSION_SECRET: 'test' }, { dataDir: dir, demo }), now: () => clock.t };
  const ctx = createApp(cfg, { chain });
  const agent = (ip = '5.5.5.5') => {
    const a = request.agent(ctx.app);
    const wrap = (m) => (u) => a[m](u).set('X-Forwarded-For', ip);
    return { get: wrap('get'), post: wrap('post'), raw: a };
  };
  return { ctx, chain, clock, dir, agent, done: () => { ctx.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

const role = (a, r) => a.post('/api/demo/ruolo').send({ role: r }).expect(200);
async function fullRun(a) {
  await role(a, 'agricoltore');
  const lot = await a.post('/api/demo/lotto').send({ cultivar: 'Leccino', kg_olive: 300 }).expect(200);
  await role(a, 'frantoio'); await a.post('/api/demo/molitura').send({}).expect(200);
  await role(a, 'laboratorio'); await a.post('/api/demo/analisi').send({ acidita: 0.3 }).expect(200);
  await role(a, 'imbottigliatore');
  const b = await a.post('/api/demo/imbottiglia').send({ n_bottiglie: 6 }).expect(200);
  return { codice: lot.body.codice, bottle: b.body };
}

test('full trial path: 4 transactions, step counter 1..5, public bottle page works', async () => {
  const { ctx, chain, agent, done } = setup();
  try {
    const a = agent();
    let me = (await a.get('/api/demo/me').expect(200)).body;
    assert.equal(me.step, 1); assert.equal(me.totalSteps, 5); assert.equal(me.active, false);
    await role(a, 'agricoltore');
    const lot = await a.post('/api/demo/lotto').send({}).expect(200);
    assert.match(lot.body.codice, /^PROVA-[A-Z0-9]{4}$/);
    assert.equal(lot.body.step, 2);
    // order: laboratory before the mill is rejected, wrong role is rejected
    await role(a, 'laboratorio');
    await a.post('/api/demo/analisi').send({}).expect(409);
    await a.post('/api/demo/molitura').send({}).expect(403);
    await role(a, 'frantoio');
    assert.equal((await a.post('/api/demo/molitura').send({ temperatura: 22 }).expect(200)).body.step, 3);
    await role(a, 'laboratorio');
    assert.equal((await a.post('/api/demo/analisi').send({}).expect(200)).body.step, 4);
    await role(a, 'imbottigliatore');
    const b = await a.post('/api/demo/imbottiglia').send({ n_bottiglie: 8 }).expect(200);
    assert.equal(b.body.step, 5);
    assert.equal(b.body.bottle_url, `/b/${lot.body.codice}/1`);
    assert.equal(chain.txs, 4);
    me = (await a.get('/api/demo/me')).body;
    assert.equal(me.step, 5); assert.equal(me.lotto.n_bottiglie, 8);
    const pub = await request(ctx.app).get(`/api/pubblico/bottiglia/${lot.body.codice}/8`).expect(200);
    assert.deepEqual(pub.body.passi.map((p) => p.fase), [0, 1, 2, 3]);
    assert.ok(pub.body.passi[2].documento.sha256);
    await request(ctx.app).get(`/api/qr/${lot.body.codice}/1.png`).expect(200);
  } finally { done(); }
});

test('sample PDF has the PDF signature (accepted by the upload sniffing)', () => {
  assert.equal(samplePdf(['a (b)']).subarray(0, 4).toString(), '%PDF');
});

test('limit per IP: 3 paths per day, other IPs and the next day unaffected', async () => {
  const { agent, clock, done } = setup();
  try {
    for (let i = 0; i < 3; i++) await fullRun(agent('7.7.7.7'));
    const a = agent('7.7.7.7');
    await role(a, 'agricoltore');
    const r = await a.post('/api/demo/lotto').send({}).expect(429);
    assert.equal(r.body.code, 'DEMO_IP_LIMIT');
    assert.equal((await a.get('/api/demo/status')).body.reason, 'ipLimit');
    await fullRun(agent('8.8.8.8')); // another IP is fine
    clock.t += 24 * 3600 * 1000; // next UTC day
    const n = agent('7.7.7.7');
    await role(n, 'agricoltore');
    await n.post('/api/demo/lotto').send({}).expect(200);
  } finally { done(); }
});

test('limit per IP is configurable and a failed chain call does not burn the quota', async () => {
  const { chain, agent, done } = setup({ runsPerIpDay: 1 });
  try {
    const a = agent();
    await role(a, 'agricoltore');
    const real = chain.creaLotto;
    chain.creaLotto = async () => { throw new Error('rpc down'); };
    await a.post('/api/demo/lotto').send({}).expect(502);
    chain.creaLotto = real;
    await a.post('/api/demo/lotto').send({}).expect(200); // quota still available
    await a.post('/api/demo/lotto').send({}).expect(429);
  } finally { done(); }
});

test('request rate limit per IP, recovers after a minute', async () => {
  const { agent, clock, done } = setup({ reqPerMin: 5 });
  try {
    const a = agent('4.4.4.4');
    for (let i = 0; i < 5; i++) await a.get('/api/demo/status').expect(200);
    const r = await a.get('/api/demo/status').expect(429);
    assert.equal(r.body.code, 'DEMO_RATE');
    assert.ok(Number(r.headers['retry-after']) >= 1);
    await agent('4.4.4.5').get('/api/demo/status').expect(200);
    clock.t += 61000;
    await a.get('/api/demo/status').expect(200);
  } finally { done(); }
});

test('global daily transaction cap (4 reserved per path), resets next day', async () => {
  const { agent, clock, done } = setup({ txPerDay: 8, runsPerIpDay: 99 });
  try {
    await fullRun(agent('1.0.0.1'));
    await fullRun(agent('1.0.0.2'));
    const a = agent('1.0.0.3');
    await role(a, 'agricoltore');
    const r = await a.post('/api/demo/lotto').send({}).expect(503);
    assert.equal(r.body.code, 'DEMO_DAILY_CAP');
    const st = (await a.get('/api/demo/status')).body;
    assert.equal(st.available, false); assert.equal(st.reason, 'dailyCap'); assert.equal(st.limits.txLeft, 0);
    clock.t += 24 * 3600 * 1000;
    await a.post('/api/demo/lotto').send({}).expect(200);
  } finally { done(); }
});

test('low funds: trial pauses, health.lowFunds, status file; resumes after top-up', async () => {
  const { ctx, chain, agent, clock, dir, done } = setup({ minPol: 0.5, balanceCacheSec: 60 });
  try {
    const a = agent();
    await role(a, 'agricoltore');
    await a.post('/api/demo/lotto').send({}).expect(200);
    chain.balances.FRANTOIO = POL / 4n; // 0.25 POL
    clock.t += 61000; // cache expired
    await role(a, 'frantoio');
    const r = await a.post('/api/demo/molitura').send({}).expect(503);
    assert.equal(r.body.code, 'DEMO_PAUSED');
    const h = (await request(ctx.app).get('/api/health').expect(200)).body;
    assert.equal(h.lowFunds, true);
    const file = JSON.parse(fs.readFileSync(path.join(dir, 'demo-status.json'), 'utf8'));
    assert.equal(file.lowFunds, true);
    assert.equal(file.wallets.find((w) => w.ruolo === 'FRANTOIO').pol, 0.25);
    assert.ok(!JSON.stringify(file).toLowerCase().includes('key'));
    assert.equal((await a.get('/api/demo/status')).body.reason, 'lowFunds');
    // top-up
    chain.balances.FRANTOIO = 3n * POL; clock.t += 61000;
    await a.post('/api/demo/molitura').send({}).expect(200);
    assert.equal((await request(ctx.app).get('/api/health')).body.lowFunds, false);
  } finally { done(); }
});

test('isolation: trial session gives no access to real-role routes or to example lots', async () => {
  const { ctx, agent, done } = setup();
  try {
    // an example (real) lot, as the seed would create it
    ctx.db.prepare("INSERT INTO lotti (codice,token_id,cultivar,zona,data_raccolta,kg_olive,n_bottiglie) VALUES ('25B001','1','Frantoio','Z',0,1,10)").run();
    ctx.db.prepare("INSERT INTO passi (lotto_codice,fase,descrizione,attore_username,timestamp) VALUES ('25B001',0,'x','agricoltore',0)").run();
    const a = agent();
    await role(a, 'agricoltore');
    await a.post('/api/demo/lotto').send({}).expect(200);
    // real routes: no login
    await a.get('/api/me').expect(401);
    await a.get('/api/lotti').expect(401);
    await a.post('/api/lotti/25B001/richiamo').send({ motivo: 'x' }).expect(401);
    await a.post('/api/lotti/25B001/passi').field('fase', '1').expect(401);
    // demo routes act only on the session lot; an example code in the body is ignored
    await role(a, 'frantoio');
    await a.post('/api/demo/molitura').send({ codice: '25B001' }).expect(200);
    assert.deepEqual(ctx.db.prepare("SELECT fase FROM passi WHERE lotto_codice = '25B001'").all().map((r) => r.fase), [0]);
    // a forged session pointing at a real lot is dropped
    const forged = request.agent(ctx.app);
    await forged.post('/api/demo/ruolo').send({ role: 'frantoio' }).expect(200);
    await forged.post('/api/demo/molitura').send({}).expect(409);
    // PROVA- codes cannot be created through the real flow
    ctx.db.prepare("INSERT OR IGNORE INTO users (username,password_hash,ruolo,must_change_password) VALUES ('t','x','PRODUTTORE',0)").run();
  } finally { done(); }
});

test('real login still works next to a demo session and does not mix', async () => {
  const { ctx, agent, done } = setup();
  try {
    const a = agent();
    await role(a, 'agricoltore');
    await a.post('/api/demo/lotto').send({}).expect(200);
    await a.post('/api/login').send({ username: 'agricoltore', password: PW.INITIAL_PASSWORD_AGRICOLTORE }).expect(200);
    await a.post('/api/cambia-password').send({ vecchia: PW.INITIAL_PASSWORD_AGRICOLTORE, nuova: 'a-brand-new-pass-1' }).expect(200);
    const me = await a.get('/api/demo/me');
    assert.equal(me.body.active, true);
    const lots = await a.get('/api/lotti').expect(200);
    assert.equal(lots.body.lotti.length, 0); // the trial lot is not listed
    // real flow cannot take the reserved prefix
    const r = await a.post('/api/lotti').field({ codice: 'PROVA-ZZZZ', cultivar: 'a', zona: 'b', data_raccolta: '2026-10-20', kg_olive: '5' }).expect(400);
    assert.match(r.body.error, /reserved/);
    void ctx;
  } finally { done(); }
});

test('trial lots are excluded from lists, example lots stay', async () => {
  const { ctx, agent, done } = setup();
  try {
    ctx.db.prepare("INSERT INTO lotti (codice,token_id,cultivar,zona,data_raccolta,kg_olive,n_bottiglie) VALUES ('25B001','1','Frantoio','Z',0,1,10)").run();
    ctx.db.prepare("INSERT INTO passi (lotto_codice,fase,descrizione,attore_username,timestamp) VALUES ('25B001',0,'x','agricoltore',0)").run();
    const { codice } = await fullRun(agent());
    assert.equal(ctx.db.prepare('SELECT demo FROM lotti WHERE codice = ?').get(codice).demo, 1);
    assert.equal(ctx.db.prepare("SELECT demo FROM lotti WHERE codice = '25B001'").get().demo, 0);
    assert.deepEqual(ctx.svc.listLotti().map((l) => l.codice), ['25B001']);
    // reachable only by direct link
    await request(ctx.app).get(`/api/pubblico/lotto/${codice}`).expect(200);
  } finally { done(); }
});

test('input validation and kill switch', async () => {
  const { agent, done } = setup();
  try {
    const a = agent();
    await role(a, 'agricoltore');
    await a.post('/api/demo/ruolo').send({ role: 'admin' }).expect(400);
    await a.post('/api/demo/lotto').send({ cultivar: '<script>' }).expect(400);
    await a.post('/api/demo/lotto').send({ kg_olive: 999999 }).expect(400);
    await a.post('/api/demo/lotto').send({ zona: 'Nowhere' }).expect(400);
    const off = setup({ enabled: false });
    try {
      const b = off.agent();
      assert.equal((await b.get('/api/demo/status')).body.reason, 'disabled');
      await b.post('/api/demo/ruolo').send({ role: 'agricoltore' }).expect(503);
    } finally { off.done(); }
  } finally { done(); }
});

test('migration adds the demo column idempotently', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { openDb } = await import('../src/db.js');
  const f = path.join(os.tmpdir(), `olio-mig-${process.pid}.db`);
  const old = new DatabaseSync(f);
  old.exec('CREATE TABLE lotti (codice TEXT PRIMARY KEY, motivo_richiamo TEXT); INSERT INTO lotti (codice) VALUES (\'A\');');
  old.close();
  openDb(f).close();
  const db = openDb(f);
  assert.ok(db.prepare('PRAGMA table_info(lotti)').all().some((c) => c.name === 'demo'));
  assert.equal(db.prepare('SELECT demo FROM lotti').get().demo, 0);
  db.close();
  fs.rmSync(f, { force: true });
});
