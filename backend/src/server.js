import 'dotenv/config';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

const cfg = loadConfig();
const { app, chain } = createApp(cfg);
app.listen(cfg.port, cfg.host, () => {
  console.log(`olio-backend on http://${cfg.host}:${cfg.port} (${chain.enabled ? 'on-chain' : 'OFFLINE: no chain configured'})`);
});
