import { describe, it, expect, vi } from 'vitest';
import { PCMDecoder, PCMQueue } from '../pcm';

describe('PCM streaming', () => {
  it('decodes signed little-endian samples across arbitrary HTTP boundaries', () => {
    const decoder = new PCMDecoder();
    expect([...decoder.decode(new Uint8Array([0]))]).toEqual([]);
    expect([...decoder.decode(new Uint8Array([128, 255, 127, 0, 0]))]).toEqual([-1, 32767 / 32768, 0]);
    decoder.finish();
  });
  it('rejects an interrupted half sample', () => {
    const decoder = new PCMDecoder(); decoder.decode(new Uint8Array([1]));
    expect(() => decoder.finish()).toThrow('Truncated');
  });
  it('schedules sequentially at the echoed rate and releases on repeated cancel', async () => {
    const starts: number[] = []; const stop = vi.fn(); const disconnect = vi.fn();
    const context = { currentTime: 1, state: 'running', destination: {},
      createGain: () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect }),
      createBuffer: vi.fn((_channels: number, samples: number, rate: number) => ({ duration: samples / rate, copyToChannel: vi.fn() })),
      createBufferSource: () => ({ connect: vi.fn(), disconnect, stop, start: (at: number) => starts.push(at) }),
      resume: vi.fn().mockResolvedValue(undefined), suspend: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined),
      getOutputTimestamp: () => ({ contextTime: 1.05, performanceTime: 200 }),
    };
    vi.stubGlobal('AudioContext', class { constructor() { return context; } });
    try {
      const controller = new AbortController(); const queue = new PCMQueue(controller.signal);
      await queue.resume(); await queue.push(new Float32Array([1, -1]), 16000); await queue.push(new Float32Array([1, -1]), 16000);
      expect(starts[1]).toBeCloseTo(starts[0] + 2 / 16000);
      expect(context.createBuffer).toHaveBeenCalledWith(1, 2, 16000);
      expect(queue.presentedAt()).toBeCloseTo(180);
      queue.mute(true); expect(queue.presentedAt()).toBeNull(); await queue.pause();
      controller.abort(); queue.close(); controller.abort();
      expect(stop).toHaveBeenCalledTimes(2); expect(context.close).toHaveBeenCalledTimes(1);
      await expect(queue.push(new Float32Array([1]), 16000)).rejects.toThrow();
    } finally { vi.unstubAllGlobals(); }
  });
});
