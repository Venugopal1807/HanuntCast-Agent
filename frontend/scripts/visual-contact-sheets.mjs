// Offline screenshot review aid; consumes existing captures, never starts the app.
import { chromium } from '@playwright/test';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve('test-results');
const files = readdirSync(root, { recursive: true }).filter(file => String(file).endsWith('.png'));
const output = join(root, 'visual-review');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1320, height: 900 } });
  for (const surface of ['landing', 'narrators', 'story', 'ending-liberation', 'ending-escape', 'ending-inheritance']) {
    const figures = [320, 375, 390, 768, 1024, 1440].map(width => {
      const file = files.find(file => String(file).endsWith(`${surface}-${width}.png`) && String(file).includes('desktop'));
      if (!file) throw new Error(`Missing ${surface} at ${width}`);
      const data = readFileSync(join(root, file)).toString('base64');
      return `<figure><figcaption>${surface} / ${width}px</figcaption><img src="data:image/png;base64,${data}"></figure>`;
    });
    await page.setContent(`<style>body{margin:0;padding:12px;background:#35303e;color:white;font:16px system-ui;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0;min-width:0}figcaption{padding:10px}img{width:100%;height:auto;display:block}</style>${figures.join('')}`);
    await page.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
    await page.screenshot({ path: join(output, `${surface}.png`), fullPage: true });
    console.log(`Created ${surface} contact sheet`);
  }
} finally { await browser.close(); }
