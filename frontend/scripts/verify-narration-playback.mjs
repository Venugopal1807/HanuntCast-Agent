// Decodes every pre-generated recording listed in the manifest in a real browser. Free; local only.
//   node scripts/verify-narration-playback.mjs <base-url>
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: process.env.HAUNTCAST_BROWSER_CHANNEL ?? 'msedge', headless: true });
const page = await browser.newPage();
await page.goto(base);
const report = await page.evaluate(async () => {
  const manifest = await (await fetch('/narration/manifest.json', { cache: 'no-store' })).json();
  const files = [...new Set([...Object.values(manifest.scenes ?? {}), ...Object.values(manifest.samples ?? {})].map(e => e.file))];
  const decode = file => new Promise(resolve => {
    const audio = new Audio(); const timer = setTimeout(() => resolve({ file, ok: false, error: 'timeout' }), 15000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => { clearTimeout(timer); resolve({ file, ok: Number.isFinite(audio.duration) && audio.duration > 0.5, seconds: audio.duration }); };
    audio.onerror = () => { clearTimeout(timer); resolve({ file, ok: false, error: audio.error?.code }); };
    audio.src = `/narration/${file}`;
  });
  const results = [];
  for (let i = 0; i < files.length; i += 8) results.push(...await Promise.all(files.slice(i, i + 8).map(decode)));
  return { files: results.length, failures: results.filter(r => !r.ok), totalSeconds: Math.round(results.reduce((s, r) => s + (r.seconds || 0), 0)) };
});
await browser.close();
console.log(JSON.stringify(report, null, 2));
process.exit(report.failures.length ? 1 : 0);
