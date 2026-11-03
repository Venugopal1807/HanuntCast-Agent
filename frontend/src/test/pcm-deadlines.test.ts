import { afterEach, expect, it, vi } from 'vitest';
import { PCMQueue } from '../pcm';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function fixture() {
  const context = { currentTime: 0, state: 'running', destination: {},
    createGain: () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }),
    createBuffer: () => ({ duration: 1, copyToChannel: vi.fn() }),
    createBufferSource: () => ({ connect: vi.fn(), disconnect: vi.fn(), stop: vi.fn(), start: vi.fn() }),
    resume: vi.fn().mockResolvedValue(undefined), suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined) };
  vi.stubGlobal('AudioContext', class { constructor() { return context; } });
  const controller = new AbortController();
  return { context, controller, queue: new PCMQueue(controller.signal) };
}

it('excludes a long intentional pause from the playback deadline', async () => {
  vi.useFakeTimers();
  const { queue, controller } = fixture();
  await queue.resume(); await queue.push(new Float32Array([1]), 16000); await queue.pause();
  await vi.advanceTimersByTimeAsync(240000);
  // Delivery must continue independently even with more than the old 15s lookahead.
  for (let i = 0; i < 20; i++) await queue.push(new Float32Array([1]), 16000);
  await queue.resume();
  const result = queue.drain().catch(error => error);
  await vi.advanceTimersByTimeAsync(50); controller.abort();
  expect((await result).name).toBe('AbortError');
});

it('still expires stalled playback that was never intentionally paused', async () => {
  vi.useFakeTimers();
  const { queue } = fixture();
  await queue.push(new Float32Array([1]), 16000);
  await vi.advanceTimersByTimeAsync(180001);
  await expect(queue.drain()).rejects.toThrow('Playback deadline exceeded');
  queue.close();
});

it.each(['resume', 'suspend'] as const)('bounds a never-resolving context %s and cleans up', async operation => {
  vi.useFakeTimers();
  const { queue, context } = fixture();
  context[operation].mockImplementation(() => new Promise(() => {}));
  const result = (operation === 'resume' ? queue.resume() : queue.pause()).catch(error => error);
  await vi.advanceTimersByTimeAsync(10001);
  expect((await result).message).toMatch(/timed out/i);
  expect(context.close).toHaveBeenCalledOnce();
});

it('cancels an unresolved context operation immediately', async () => {
  const { queue, context, controller } = fixture();
  context.resume.mockImplementation(() => new Promise(() => {}));
  const result = queue.resume().catch(error => error); controller.abort();
  expect((await result).name).toBe('AbortError');
  expect(context.close).toHaveBeenCalledOnce();
});
