import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// VITE_PROXY_TARGET: where the dev server proxies /api (default: local backend on 3802).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5174, host: '127.0.0.1', proxy: { '/api': env.VITE_PROXY_TARGET || 'http://127.0.0.1:3802' } },
    preview: { port: 5174 },
    test: { environment: 'node' },
  };
});
