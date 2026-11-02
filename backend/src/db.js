import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      ruolo TEXT NOT NULL,
      wallet_address TEXT,
      must_change_password INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS lotti (
      codice TEXT PRIMARY KEY,
      token_id TEXT,
      cultivar TEXT NOT NULL,
      zona TEXT NOT NULL,
      data_raccolta INTEGER NOT NULL,
      kg_olive INTEGER NOT NULL,
      n_bottiglie INTEGER NOT NULL DEFAULT 0,
      richiamato INTEGER NOT NULL DEFAULT 0,
      motivo_richiamo TEXT,
      tx_create TEXT
    );
    CREATE TABLE IF NOT EXISTS documenti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lotto_codice TEXT NOT NULL,
      fase INTEGER NOT NULL,
      filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS passi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lotto_codice TEXT NOT NULL,
      fase INTEGER NOT NULL,
      descrizione TEXT NOT NULL,
      attore_username TEXT NOT NULL,
      attore_address TEXT,
      timestamp INTEGER NOT NULL,
      doc_id INTEGER,
      tx_hash TEXT
    );
  `);
  // Idempotent migrations (databases created before the English columns existed).
  const addCol = (table, col) => {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`);
  };
  addCol('passi', 'descrizione_en');
  if (!db.prepare('PRAGMA table_info(lotti)').all().some((c) => c.name === 'demo')) db.exec('ALTER TABLE lotti ADD COLUMN demo INTEGER NOT NULL DEFAULT 0');
  db.exec(`
    CREATE TABLE IF NOT EXISTS demo_runs (day TEXT NOT NULL, ip_hash TEXT NOT NULL, runs INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, ip_hash));
    CREATE TABLE IF NOT EXISTS demo_tx (day TEXT PRIMARY KEY, tx INTEGER NOT NULL DEFAULT 0);
  `);
  addCol('lotti', 'motivo_richiamo_en');
  return db;
}
