import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Actors: username -> role. Roles map to the on-chain roles of PietreDiVita.
export const ACTORS = [
  { username: 'agricoltore', ruolo: 'PRODUTTORE', keyEnv: 'KEY_PRODUTTORE', pwEnv: 'INITIAL_PASSWORD_AGRICOLTORE' },
  { username: 'frantoio', ruolo: 'FRANTOIO', keyEnv: 'KEY_FRANTOIO', pwEnv: 'INITIAL_PASSWORD_FRANTOIO' },
  { username: 'laboratorio', ruolo: 'LABORATORIO', keyEnv: 'KEY_LABORATORIO', pwEnv: 'INITIAL_PASSWORD_LABORATORIO' },
  { username: 'imbottigliatore', ruolo: 'IMBOTTIGLIATORE', keyEnv: 'KEY_IMBOTTIGLIATORE', pwEnv: 'INITIAL_PASSWORD_IMBOTTIGLIATORE' },
];

export const FASI = ['Raccolta', 'Molitura', 'Analisi', 'Imbottigliamento', 'Spedizione'];
// Which role may register each phase.
export const FASE_RUOLO = ['PRODUTTORE', 'FRANTOIO', 'LABORATORIO', 'IMBOTTIGLIATORE', 'PRODUTTORE'];

export function loadConfig(env = process.env, overrides = {}) {
  const dataDir = overrides.dataDir ?? path.join(ROOT, 'data');
  return {
    port: Number(env.PORT || 3802),
    host: '127.0.0.1',
    rpcUrl: env.RPC_URL || '',
    chainId: Number(env.CHAIN_ID || 80002),
    contractAddress: env.CONTRACT_ADDRESS || '',
    keys: Object.fromEntries(ACTORS.map((a) => [a.ruolo, env[a.keyEnv] || ''])),
    sessionSecret: env.SESSION_SECRET || 'dev-only-change-me',
    publicBaseUrl: env.PUBLIC_BASE_URL || 'http://localhost:5174',
    explorerBase: env.EXPLORER_BASE || 'https://amoy.polygonscan.com',
    passwords: Object.fromEntries(ACTORS.map((a) => [a.username, env[a.pwEnv] || `change-me-${a.username}`])),
    dataDir,
    dbPath: overrides.dbPath ?? path.join(dataDir, 'olio.db'),
    uploadDir: overrides.uploadDir ?? path.join(dataDir, 'uploads'),
    abiPath: overrides.abiPath ?? path.join(ROOT, '..', 'contracts', 'abi', 'PietreDiVita.json'),
    forceOffline: overrides.forceOffline ?? false,
  };
}
