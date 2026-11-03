import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': process.env.HAUNTCAST_API_TARGET ?? 'http://127.0.0.1:8000' } },
  preview: { proxy: { '/api': process.env.HAUNTCAST_API_TARGET ?? 'http://127.0.0.1:8000' } },
  test: { include: ['src/test/**/*.test.{ts,tsx}'], environment: 'jsdom', setupFiles: './src/test/setup.ts', clearMocks: true },
});
