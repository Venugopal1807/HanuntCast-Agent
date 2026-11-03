// Real app + real Web Audio. Default: simulated upstream, never a paid request.
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const live = process.argv.includes('--live');
if (process.argv.slice(2).some(arg => arg !== '--live')) throw new Error('Only --live is supported.');
if (live && process.env.HAUNTCAST_LIVE_STREAM_SMOKE !== '1') {
  throw new Error('Stop: explicit authorization and HAUNTCAST_LIVE_STREAM_SMOKE=1 are required.');
}
const mode = live ? 'live' : 'rehearsal';
const directory = join(root, 'test-results/assemblyai-stream-smoke', mode);
if (live && existsSync(join(directory, 'attempt.json'))) throw new Error('Blocked rerun of a paid attempt.');
mkdirSync(directory, { recursive: true });
const backendURL = 'http://127.0.0.1:18010';
const frontendURL = 'http://127.0.0.1:14183';
const children = [];
let browser;
const report = { mode, live, physical_speaker_audibility_verified: false, stream_http_requests: 0,
  credit_amount: null };
const check = (condition, message) => { if (!condition) throw new Error(message); };

async function available(url) {
  try { await fetch(url, { signal: AbortSignal.timeout(500) }); return true; } catch { return false; }
}
async function ready(url, child) {
  for (let n = 0; n < 100; n++) {
    if (child.exitCode !== null) throw new Error('Validation server exited.');
    if (await available(url)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Local server startup timed out.');
}
function start(command, args, cwd, extraEnv = {}) {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...extraEnv },
    windowsHide: true, stdio: 'ignore' });
  children.push(child);
  return child;
}

try {
  check(!await available(backendURL + '/api/auth') && !await available(frontendURL), 'Validation ports must be free.');
  const backend = start(join(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python'),
    [join(root, 'backend/tools/streaming_smoke.py'), '--mode', mode], root);
  await ready(backendURL + '/api/auth', backend);
  const frontend = start(process.execPath,
    [join(root, 'frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '14183', '--strictPort'],
    join(root, 'frontend'), { HAUNTCAST_API_TARGET: backendURL });
  await ready(frontendURL, frontend);
  browser = await chromium.launch({ channel: process.env.HAUNTCAST_BROWSER_CHANNEL ?? 'msedge', headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext();
  // No HAR, trace, console capture, request headers or JWT artifacts.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== frontendURL) return route.abort();
    if (url.pathname.endsWith('/audio/stream')) {
      report.stream_http_requests++;
      if (report.stream_http_requests > 1) return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', () => { report.page_error = true; });
  await page.addInitScript(() => {
    const evidence = { reads: [], events: [], schedules: [], states: [], gains: [], contexts: [],
      audio: [], presented: null, requestedAt: null };
    window.__streamSmoke = evidence;
    document.addEventListener('click', event => {
      if (evidence.clickedAt === undefined && event.target.closest('button')?.textContent.trim() === 'Play live narration') {
        evidence.clickedAt = performance.now();
      }
    }, true);
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const path = String(args[0]);
      if (!path.includes('/audio/stream?')) return originalFetch(...args);
      evidence.requestedAt = performance.now();
      const response = await originalFetch(...args);
      evidence.httpStatus = response.status;
      const originalReader = response.body.getReader.bind(response.body);
      response.body.getReader = (...options) => {
        const reader = originalReader(...options);
        const read = reader.read.bind(reader);
        const decoder = new TextDecoder(); let pending = '';
        reader.read = async () => {
          const result = await read();
          evidence.reads.push({ at: performance.now(), bytes: result.value?.length ?? 0, done: result.done });
          if (result.value) {
            pending += decoder.decode(result.value, { stream: true });
            let boundary;
            while ((boundary = pending.indexOf('\n')) >= 0) {
              const event = JSON.parse(pending.slice(0, boundary)); pending = pending.slice(boundary + 1);
              evidence.events.push({ type: event.type, at: performance.now() });
              if (event.type === 'begin') evidence.sampleRate = event.sample_rate;
              if (event.type === 'audio') evidence.audio.push(event.audio);
              if (event.type === 'done') evidence.serverMs = event.server_first_audio_ms;
              if (event.type === 'error') evidence.providerError = true;
            }
          }
          return result;
        };
        return reader;
      };
      return response;
    };
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor(...args) {
        super(...args);
        evidence.contexts.push(this);
        this.addEventListener('statechange', () => evidence.states.push(this.state));
        const gain = this.createGain.bind(this);
        this.createGain = () => { const node = gain(); evidence.gains.push(node); return node; };
        const create = this.createBufferSource.bind(this);
        this.createBufferSource = () => {
          const source = create(); const start = source.start.bind(source);
          source.start = (at, ...rest) => {
            const samples = source.buffer.getChannelData(0);
            const offset = samples.findIndex(sample => Math.abs(sample) > 1 / 32768);
            const entry = { receivedAt: performance.now(), at, duration: source.buffer.duration,
              sampleRate: source.buffer.sampleRate, frames: source.buffer.length, context: evidence.contexts.length };
            evidence.schedules.push(entry);
            if (evidence.firstSound === undefined && offset >= 0) evidence.firstSound = at + offset / source.buffer.sampleRate;
            return start(at, ...rest);
          };
          return source;
        };
      }
    };
    setInterval(() => {
      const context = evidence.contexts[0];
      if (!context || context.state !== 'running' || evidence.presented !== null || evidence.firstSound === undefined) return;
      const stamp = context.getOutputTimestamp?.();
      if (stamp?.contextTime >= evidence.firstSound && stamp.performanceTime > 0) {
        evidence.presented = { observedAt: performance.now(),
          outputAt: stamp.performanceTime - (stamp.contextTime - evidence.firstSound) * 1000 };
      }
    }, 10);
  });
  await page.goto(frontendURL);
  await page.getByRole('button', { name: 'Start the experience' }).click();
  await page.locator('input[value="medium"]').check();
  await page.getByRole('button', { name: 'Enter Blackthorn House' }).click();
  await expect(page.getByText('LIVE TTS', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play live narration', exact: true }).click();
  // A failed paid attempt ends here; no Retry, Replay or second synthesis is attempted.
  await page.waitForFunction(() => ['Replay ready', 'Stopped · Audio needs your attention'].includes(
    document.querySelector('.audio-status')?.textContent ?? ''), undefined, { timeout: 135000 });
  await expect(page.locator('.audio-status')).toHaveText('Replay ready');
  const evidence = await page.evaluate(() => {
    const e = window.__streamSmoke;
    return { reads: e.reads, events: e.events, schedules: e.schedules, audio: e.audio,
      presented: e.presented, requestedAt: e.requestedAt, clickedAt: e.clickedAt, firstSound: e.firstSound,
      sampleRate: e.sampleRate, serverMs: e.serverMs, httpStatus: e.httpStatus, providerError: e.providerError ?? false };
  });
  const pcm = Buffer.concat(evidence.audio.map(chunk => Buffer.from(chunk, 'base64')));
  const doneAt = evidence.events.find(event => event.type === 'done')?.at;
  const audioEvents = evidence.events.filter(event => event.type === 'audio');
  report.audio_chunks = audioEvents.length;
  report.pcm_bytes = pcm.length;
  report.pcm_sha256 = createHash('sha256').update(pcm).digest('hex');
  report.sample_rate = evidence.sampleRate;
  report.audio_duration_seconds = pcm.length / (evidence.sampleRate * 2);
  report.server_first_audio_ms = evidence.serverMs;
  report.browser_first_chunk_ms = audioEvents[0]?.at - evidence.clickedAt;
  report.browser_output_ms = evidence.presented ? evidence.presented.outputAt - evidence.clickedAt : null;
  report.scheduled_before_done = evidence.schedules[0]?.receivedAt < doneAt;
  report.output_observed_before_done = evidence.presented ? evidence.presented.observedAt < doneAt : null;
  report.chunk_read_count = evidence.reads.filter(read => read.bytes > 0).length;
  report.http_status = evidence.httpStatus;
  report.provider_error = evidence.providerError;
  report.playback_completed = true;
  await page.locator('.player-diagnostics summary').click();
  const displayed = await page.locator('.fine-print').filter({ hasText: 'Browser output:' }).innerText();
  await page.locator('.player-diagnostics summary').click();
  const metrics = displayed.match(/Browser output: (unavailable|\d+ ms) \/ Server first audio: (\d+) ms/);
  report.app_browser_output_ms = metrics && metrics[1] !== 'unavailable' ? Number.parseInt(metrics[1], 10) : null;
  report.audio_order_valid = evidence.schedules.every((entry, i, all) => i === 0
    || entry.at + 0.00001 >= all[i - 1].at + all[i - 1].duration);
  check(report.audio_chunks > 0 && pcm.some(byte => byte !== 0), 'No non-silent audio.');
  check(report.scheduled_before_done && report.audio_order_valid, 'Audio scheduling validation failed.');
  check(evidence.schedules.every(entry => entry.sampleRate === evidence.sampleRate), 'Sample-rate mismatch.');
  check(evidence.schedules.reduce((frames, entry) => frames + entry.frames, 0) * 2 === pcm.length,
    'Scheduled audio length mismatch.');

  // Completed cache only: controls and scene interruption consume no extra synthesis.
  await page.getByRole('button', { name: 'Replay narration' }).click();
  await page.getByRole('button', { name: /Pause/ }).click();
  await expect(page.locator('.audio-status')).toHaveText('Paused');
  const pausedAt = await page.evaluate(() => window.__streamSmoke.contexts.at(-1).currentTime);
  await page.waitForTimeout(150);
  const pausedLater = await page.evaluate(() => window.__streamSmoke.contexts.at(-1).currentTime);
  report.pause_held_timeline = Math.abs(pausedLater - pausedAt) < 0.02;
  await page.getByRole('button', { name: /Resume/ }).click();
  await page.getByRole('button', { name: 'Mute audio', exact: true }).click();
  report.mute_zero_gain = await page.evaluate(() => window.__streamSmoke.gains.at(-1).gain.value === 0);
  await expect(page.locator('.audio-status')).toHaveText('Muted · playback continues');
  const mutedAt = await page.evaluate(() => window.__streamSmoke.contexts.at(-1).currentTime);
  await page.waitForTimeout(150);
  report.mute_timeline_continued = await page.evaluate(before =>
    window.__streamSmoke.contexts.at(-1).currentTime > before + 0.05, mutedAt);
  await page.getByRole('button', { name: 'Unmute audio', exact: true }).click();
  report.unmute_restored_gain = await page.evaluate(() => window.__streamSmoke.gains.at(-1).gain.value === 1);
  await page.getByRole('button', { name: 'Cancel audio' }).click();
  await expect(page.locator('.audio-status')).toHaveText('Stopped · Ready when you are');
  report.cancel_closed_context = await page.evaluate(() => window.__streamSmoke.contexts.at(-1).state === 'closed');
  await page.getByRole('button', { name: 'Replay narration' }).click();
  await page.getByRole('button', { name: /Take the brass key/ }).click();
  await expect(page.getByRole('heading', { name: 'The house knows your name.' })).toBeVisible();
  report.scene_change_closed_context = await page.evaluate(() => window.__streamSmoke.contexts.at(-1).state === 'closed');
  await expect(page.locator('.audio-status')).toHaveText('Stopped · Ready when you are');
  const backendReport = JSON.parse(readFileSync(join(directory, 'backend.json'), 'utf8'));
  report.backend = backendReport;
  check(backendReport.pcm_sha256 === report.pcm_sha256 && backendReport.audio_chunks === report.audio_chunks,
    'Browser audio differs from upstream audio.');
  check(backendReport.generate_frames === 1 && backendReport.flush_frames === 1
    && backendReport.connection_attempts === 1 && report.stream_http_requests === 1, 'Unexpected request count.');
  check(backendReport.termination_received && backendReport.completed && !report.provider_error && !report.page_error,
    'Incomplete provider/browser lifecycle.');
  check(report.pause_held_timeline && report.mute_zero_gain && report.mute_timeline_continued && report.unmute_restored_gain
    && report.cancel_closed_context && report.scene_change_closed_context, 'Playback control validation failed.');
  report.passed = true;
} catch {
  report.passed = false;
  report.error = 'Streaming smoke failed; no automatic retry was attempted. Inspect validated artifacts.';
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) {
    child.kill();
    await Promise.race([new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 2000))]);
  }
  const backendResult = join(directory, 'backend.json');
  if (existsSync(backendResult)) report.backend = JSON.parse(readFileSync(backendResult, 'utf8'));
  writeFileSync(join(directory, 'browser.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
