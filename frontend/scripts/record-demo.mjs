// Records the 60–90 s judge demo from the real running app and mixes the REAL AssemblyAI files
// that actually played into the soundtrack (the browser's own audio output is not captured).
// Final mode refuses to record a scene that would fall back to MOCK AUDIO.
//
//   node scripts/record-demo.mjs <base-url> <out-dir> <ffmpeg-path> [--draft]
//
// --draft lets the pipeline run before scene narration exists; it captions that clearly.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const [base, out, ffmpeg] = process.argv.slice(2);
const draft = process.argv.includes('--draft');
if (!base || !out || !ffmpeg) throw new Error('usage: record-demo.mjs <base-url> <out-dir> <ffmpeg> [--draft]');
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const rawDir = path.join(out, 'raw'); mkdirSync(rawDir, { recursive: true });
const NAMES = { archivist: 'The Archivist', skeptic: 'The Skeptic', medium: 'The Medium' };
const VOICE = { archivist: 'George', skeptic: 'Jane', medium: 'Audrey' };

const browser = await chromium.launch({ channel: process.env.HAUNTCAST_BROWSER_CHANNEL ?? 'msedge', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'] });
// Native 1080p capture; CSS zoom renders the 1280-px layout crisply at full HD (Playwright records CSS pixels).
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
  recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } } });
await context.addInitScript(() => {
  document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.zoom = '1.5'; });
  window.__audio = [];
  const original = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const el = /** @type {HTMLMediaElement & { __logged?: boolean }} */ (this); // eslint-disable-line @typescript-eslint/no-this-alias
    if (!el.__logged) {
      el.__logged = true;
      el.addEventListener('playing', () => window.__audio.push({ src: el.src, kind: 'start', at: Date.now(), offset: el.currentTime }));
      for (const kind of ['pause', 'ended']) el.addEventListener(kind, () => window.__audio.push({ src: el.src, kind: 'stop', at: Date.now() }));
    }
    return original.call(this);
  };
});
const page = await context.newPage();
const t0 = Date.now(); // Video timeline origin (recording starts with the page).
const wait = ms => page.waitForTimeout(ms);
async function caption(text, sub = '') {
  await page.evaluate(([text, sub]) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div'); el.id = 'demo-caption'; el.setAttribute('aria-hidden', 'true');
      el.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:9999;max-width:86%;'
        + 'background:rgba(10,11,18,.92);border:1px solid #7770ef;border-radius:4px;padding:12px 22px;text-align:center;'
        + 'font:600 22px "Segoe UI",system-ui,sans-serif;color:#f1ecfb;pointer-events:none;transition:opacity .25s';
      document.body.appendChild(el);
    }
    el.innerHTML = text ? `${text}${sub ? `<div style="font-weight:400;font-size:15px;color:#c9c2dc;margin-top:4px">${sub}</div>` : ''}` : '';
    el.style.opacity = text ? '1' : '0';
  }, [text, sub]);
}
async function settle() { await page.locator('#narration:not([data-recording="checking"])').waitFor(); }
async function narrate(ms, label, focus = null) {
  const frame = async () => { if (focus) await page.locator(focus).evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'smooth' })); };
  await settle();
  const source = await page.locator('#narration').getAttribute('data-source');
  if (source !== 'pregenerated') {
    if (!draft) throw new Error(`Refusing final cut: "${label}" has no real AssemblyAI recording (would be MOCK AUDIO).`);
    await caption('DRAFT · scene narration pending generation', 'This scene would use the labeled mock fallback');
    await frame(); await wait(Math.min(ms, 2500)); return;
  }
  await page.locator('.play-action').click();
  await page.waitForFunction(() => /Playing/.test(document.querySelector('.audio-status')?.textContent ?? ''), null, { timeout: 10000 });
  await frame(); await wait(ms);
}
async function choose(label) {
  const before = await page.locator('h1').first().textContent();
  await page.getByRole('button', { name: label }).scrollIntoViewIfNeeded();
  await wait(500);
  await page.getByRole('button', { name: label }).click();
  await page.waitForFunction(b => document.querySelector('h1')?.textContent !== b, before);
  await page.evaluate(() => window.scrollTo({ top: 0 }));
}

// 1. Opening
await page.goto(base);
await page.getByText(/pre-generated AssemblyAI voice|Demo mode/).waitFor();
await caption('BLACKTHORN HOUSE', 'An interactive horror story told aloud by AssemblyAI-TTS-1 voices');
await wait(5500);
// 2. Three narrators, real samples
await page.getByRole('button', { name: /Start the experience/ }).click();
await caption('Three narrators · three AssemblyAI voices', 'George · Jane · Audrey');
await wait(2500);
for (const persona of ['archivist', 'skeptic', 'medium']) {
  const button = page.getByRole('button', { name: `Hear a pre-generated AssemblyAI sample of ${NAMES[persona]}` });
  if (!(await button.count())) {
    if (!draft) throw new Error(`Refusing final cut: no real voice sample for ${NAMES[persona]}.`);
    await caption(`${NAMES[persona]} · ${VOICE[persona]}`, 'DRAFT · voice sample pending generation'); await wait(1500); continue;
  }
  await caption(`${NAMES[persona]} · voice ${VOICE[persona]}`, 'Real AssemblyAI-TTS-1 sample, generated in advance');
  await button.click();
  await wait(persona === 'medium' ? 3800 : 4500);
  const stop = page.getByRole('button', { name: `Stop a pre-generated AssemblyAI sample of ${NAMES[persona]}` });
  if (await stop.count()) await stop.click();
  await wait(400);
}
// 3. Enter the story as the Medium
await page.getByRole('radio', { name: 'The Medium' }).check();
await page.getByRole('button', { name: /Enter Blackthorn House/ }).click();
await page.locator('.story-page').waitFor();
await caption('Every scene is narrated in the chosen voice', 'Pre-generated with AssemblyAI-TTS-1 for this exact text');
await narrate(9000, 'chapter 1');
// 4. Choices and consequences
await caption('Your choices are remembered', 'Study the portrait: you recover her name');
await choose(/Study the girl's portrait/);
await narrate(4500, 'chapter 2');
await caption('A promise has weight in this house');
await choose(/Promise to help the girl/);
await narrate(4500, 'chapter 3');
await caption('The turning point', 'Untie the ribbon: Liberation becomes possible');
await choose(/Untie the girl's ribbon/);
await narrate(4000, 'chapter 4');
// 5. Personalized ending
await caption('One of 189 personalized endings', 'It remembers the name, the promise and the ribbon');
await choose(/Lead the girl into the dawn/);
await page.getByText('ENDING DISCOVERED / LIBERATION').waitFor();
await page.evaluate(() => window.scrollTo({ top: 0 }));
await narrate(12000, 'ending');
await page.locator('.journal summary').click();
await wait(2500);
// 6. Close
if (await page.locator('.cancel-audio:not([disabled])').count()) await page.locator('.cancel-audio').click();
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await caption('BLACKTHORN HOUSE · built with AssemblyAI-TTS-1', 'github.com/Venugopal1807/HanuntCast-Agent');
await wait(4500);

const events = await page.evaluate(() => window.__audio);
const videoPath = await page.video().path();
await context.close(); await browser.close();

// Real AssemblyAI audio segments that actually played (static /narration/ files only; never mock blobs).
const segments = []; const open = new Map();
for (const event of events) {
  const url = new URL(event.src);
  if (!url.pathname.startsWith('/narration/')) continue;
  if (event.kind === 'start') open.set(event.src, event);
  else if (open.has(event.src)) {
    const start = open.get(event.src); open.delete(event.src);
    segments.push({ file: path.join(publicDir, decodeURIComponent(url.pathname)), startMs: Math.max(0, start.at - t0),
      offset: start.offset, durationMs: event.at - start.at });
  }
}
const video = path.join(out, 'blackthorn-demo-video-only.webm'); renameSync(videoPath, video);
const output = path.join(out, draft ? 'blackthorn-demo-DRAFT.mp4' : 'blackthorn-demo.mp4');
const inputs = ['-y', '-i', video]; const filters = [];
segments.forEach((s, i) => {
  if (!existsSync(s.file)) throw new Error(`Missing narration file ${s.file}`);
  inputs.push('-i', s.file);
  filters.push(`[${i + 1}:a]atrim=start=${s.offset.toFixed(3)}:duration=${(s.durationMs / 1000).toFixed(3)},asetpts=PTS-STARTPTS,`
    + `aresample=48000,afade=t=out:st=${Math.max(0, s.durationMs / 1000 - 0.25).toFixed(3)}:d=0.25,adelay=${s.startMs}|${s.startMs}[a${i}]`);
});
const args = [...inputs];
if (segments.length) {
  filters.push(`${segments.map((_, i) => `[a${i}]`).join('')}amix=inputs=${segments.length}:normalize=0,aformat=channel_layouts=stereo[aout]`);
  args.push('-filter_complex', filters.join(';'), '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '160k');
} else args.push('-map', '0:v', '-an');
args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output);
execFileSync(ffmpeg, args, { stdio: 'inherit' });
writeFileSync(path.join(out, 'demo-audio-segments.json'), JSON.stringify({ draft, segments: segments.map(s => ({ ...s, file: path.relative(publicDir, s.file) })) }, null, 2));
console.log(JSON.stringify({ output, draft, realAudioSegments: segments.length, files: readdirSync(out) }, null, 2));
