import express from 'express';
import cookieSession from 'cookie-session';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import path from 'node:path';
import fs from 'node:fs';
import { ACTORS } from './config.js';
import { openDb } from './db.js';
import { createChain, httpError } from './chain.js';
import { createService } from './service.js';

export function ensureUsers(db, cfg, chain) {
  const ins = db.prepare('INSERT OR IGNORE INTO users (username,password_hash,ruolo,wallet_address,must_change_password) VALUES (?,?,?,?,1)');
  for (const a of ACTORS) ins.run(a.username, bcrypt.hashSync(cfg.passwords[a.username], 10), a.ruolo, chain.addressOf(a.ruolo));
  const upd = db.prepare('UPDATE users SET wallet_address = ? WHERE ruolo = ? AND ? IS NOT NULL');
  for (const a of ACTORS) upd.run(chain.addressOf(a.ruolo), a.ruolo, chain.addressOf(a.ruolo));
}

export function createApp(cfg) {
  const db = openDb(cfg.dbPath);
  const chain = createChain(cfg);
  ensureUsers(db, cfg, chain);
  const svc = createService({ db, cfg, chain });

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(
    cookieSession({
      name: 'olio_session',
      keys: [cfg.sessionSecret],
      httpOnly: true,
      sameSite: 'lax',
      secure: cfg.publicBaseUrl.startsWith('https://'),
      maxAge: 8 * 3600 * 1000,
    }),
  );
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).then((r) => r !== undefined && res.json(r), next);

  const userOf = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const publicUser = (u) => ({
    username: u.username,
    ruolo: u.ruolo,
    wallet_address: u.wallet_address,
    must_change_password: !!u.must_change_password,
  });
  const auth = (req, _res, next) => {
    const u = req.session?.uid && userOf(req.session.uid);
    if (!u) return next(httpError(401, 'Login required'));
    req.user = u;
    next();
  };
  const authWrite = (req, res, next) =>
    auth(req, res, (err) => {
      if (err) return next(err);
      if (req.user.must_change_password) return next(Object.assign(httpError(403, 'Password change required'), { code: 'MUST_CHANGE_PASSWORD' }));
      next();
    });

  // Tiny in-memory login throttle: 10 failures per minute per IP.
  const fails = new Map();

  app.get('/api/health', (_req, res) => res.json({ ok: true, mode: chain.enabled ? 'onchain' : 'offline', offline: !chain.enabled }));

  app.post('/api/login', wrap((req) => {
    const now = Date.now();
    const f = (fails.get(req.ip) ?? []).filter((t) => now - t < 60000);
    if (f.length >= 10) throw httpError(429, 'Too many attempts, try again in a minute');
    const { username, password } = req.body ?? {};
    const u = typeof username === 'string' && db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!u || typeof password !== 'string' || !bcrypt.compareSync(password, u.password_hash)) {
      f.push(now);
      fails.set(req.ip, f);
      throw httpError(401, 'Invalid credentials');
    }
    req.session = { uid: u.id };
    return { ok: true, user: publicUser(u) };
  }));
  app.post('/api/logout', (req, res) => {
    req.session = null;
    res.json({ ok: true });
  });
  app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user), offline: !chain.enabled }));
  app.post('/api/cambia-password', auth, wrap((req) => {
    const { vecchia, nuova } = req.body ?? {};
    if (typeof vecchia !== 'string' || !bcrypt.compareSync(vecchia, req.user.password_hash)) throw httpError(401, 'Current password is wrong');
    if (typeof nuova !== 'string' || nuova.length < 10) throw httpError(400, 'New password must be at least 10 characters');
    if (nuova === vecchia) throw httpError(400, 'New password must differ from the current one');
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(bcrypt.hashSync(nuova, 10), req.user.id);
    return { ok: true };
  }));

  app.get('/api/lotti', auth, (_req, res) => res.json({ offline: !chain.enabled, lotti: svc.listLotti() }));
  app.post('/api/lotti', authWrite, upload.single('photo'), wrap((req) => svc.creaLotto(req.user, req.body ?? {}, req.file)));
  app.post('/api/lotti/:codice/passi', authWrite, upload.single('file'), wrap((req) => svc.aggiungiPasso(req.user, req.params.codice, req.body ?? {}, req.file)));
  app.post('/api/lotti/:codice/imbottiglia', authWrite, upload.single('file'), wrap((req) => svc.imbottiglia(req.user, req.params.codice, req.body ?? {}, req.file)));
  app.post('/api/lotti/:codice/richiamo', authWrite, wrap((req) => svc.richiama(req.user, req.params.codice, req.body ?? {})));

  app.get('/api/pubblico/lotto/:codice', wrap((req) => svc.pubblicoLotto(req.params.codice)));
  app.get('/api/pubblico/bottiglia/:codice/:n', wrap((req) => svc.pubblicoBottiglia(req.params.codice, req.params.n)));

  app.get('/api/qr/:codice/:n.png', wrap(async (req, res) => {
    await svc.pubblicoBottiglia(req.params.codice, req.params.n); // 404 for unknown bottles
    const url = `${cfg.publicBaseUrl}/b/${encodeURIComponent(req.params.codice)}/${Number(req.params.n)}`;
    const png = await QRCode.toBuffer(url, { type: 'png', margin: 2, width: 400 });
    res.type('image/png').send(png);
  }));

  app.get('/api/documenti/:id', (req, res, next) => {
    const d = db.prepare('SELECT * FROM documenti WHERE id = ?').get(Number(req.params.id));
    if (!d) return next(httpError(404, 'Document not found'));
    const full = path.join(cfg.uploadDir, path.basename(d.stored_path));
    if (!fs.existsSync(full)) return next(httpError(404, 'File missing'));
    res.type(d.mime).set('Content-Disposition', `inline; filename="${d.filename.replace(/[^\w.-]/g, '_')}"`).sendFile(full);
  });

  app.use('/api', (_req, _res, next) => next(httpError(404, 'Not found')));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    let status = err.status || 500;
    let message = err.message;
    if (err instanceof multer.MulterError) {
      status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5 MB)' : err.message;
    }
    if (status >= 500 && !err.status) console.error(err);
    res.status(status).json({ ok: false, error: status >= 500 && !err.status ? 'Internal error' : message, code: err.code });
  });

  return { app, db, chain, svc, close: () => db.close() };
}
