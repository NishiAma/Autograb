/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // In development (and `vite preview`) the browser calls /api on the Vite
  // origin and Vite forwards it to Express, so no CORS configuration is needed.
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:3001';
  const proxy = { '/api': { target: apiTarget, changeOrigin: true } };

  return {
    plugins: [react()],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
    },
  };
});
