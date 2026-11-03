import { defineConfig } from '@playwright/test';

const windows = process.platform === 'win32';
export default defineConfig({
  testDir: './e2e', timeout: 30000, fullyParallel: false, workers: 1, retries: 0, reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:14173', channel: process.env.HAUNTCAST_BROWSER_CHANNEL ?? 'msedge',
    headless: true, trace: 'off', screenshot: 'only-on-failure',
    // No trace/network archive: anonymous bearer tokens must not become artifacts.
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    {
      command: `${windows ? '..\\.venv\\Scripts\\python.exe' : '../.venv/bin/python'} -m uvicorn app.main:app --app-dir ../backend --host 127.0.0.1 --port 18000 --no-access-log`,
      url: 'http://127.0.0.1:18000/api/capabilities', reuseExistingServer: false,
      env: { VOICE_PROVIDER: 'mock', STORY_PROVIDER: 'demo', JWT_SECRET: '' },
    },
    {
      command: `${windows ? 'npm.cmd' : 'npm'} run preview -- --port 14173 --strictPort`,
      url: 'http://127.0.0.1:14173', reuseExistingServer: false,
      env: { HAUNTCAST_API_TARGET: 'http://127.0.0.1:18000' },
    },
  ],
});
