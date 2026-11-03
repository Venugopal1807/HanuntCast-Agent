// PCM frames may be split at any byte by HTTP. Decode explicitly little-endian.
export class PCMDecoder {
  private carry: number | null = null;
  decode(input: Uint8Array): Float32Array {
    const bytes = new Uint8Array(input.length + (this.carry === null ? 0 : 1));
    if (this.carry !== null) { bytes[0] = this.carry; bytes.set(input, 1); } else bytes.set(input);
    const count = Math.floor(bytes.length / 2);
    this.carry = bytes.length % 2 ? bytes[bytes.length - 1] : null;
    const view = new DataView(bytes.buffer);
    return Float32Array.from({ length: count }, (_, i) => view.getInt16(i * 2, true) / 32768);
  }
  finish() { if (this.carry !== null) throw new Error('Truncated PCM sample'); }
}

export class PCMQueue {
  readonly context: AudioContext;
  private gain: GainNode;
  private sources = new Set<AudioBufferSourceNode>();
  private end = 0;
  private closed = false;
  private expires = performance.now() + 180000;
  private pausedAt: number | null = null;
  private scheduledSeconds = 0;
  private operation: Promise<void> | null = null;
  private abort = () => this.close();
  private firstSound: number | null = null;
  constructor(private signal: AbortSignal) {
    this.context = new AudioContext();
    this.gain = this.context.createGain(); this.gain.connect(this.context.destination);
    signal.addEventListener('abort', this.abort, { once: true });
    if (signal.aborted) this.close();
  }
  private control(pausing: boolean): Promise<void> {
    if (this.operation) return this.operation;
    this.operation = new Promise<void>((resolve, reject) => {
      const finish = (error?: unknown) => {
        clearTimeout(timer); this.signal.removeEventListener('abort', abort);
        if (error) { this.close(); reject(error); } else resolve();
      };
      const abort = () => finish(new DOMException('Canceled', 'AbortError'));
      const timer = setTimeout(() => finish(new Error('AudioContext operation timed out')), 10000);
      this.signal.addEventListener('abort', abort, { once: true });
      if (this.signal.aborted || this.closed) { abort(); return; }
      try {
        void (pausing ? this.context.suspend() : this.context.resume()).then(() => {
          if (this.closed || this.signal.aborted) { abort(); return; }
          if (pausing && this.pausedAt === null) this.pausedAt = performance.now();
          if (!pausing && this.pausedAt !== null) {
            this.expires += performance.now() - this.pausedAt; this.pausedAt = null;
          }
          finish();
        }, finish);
      } catch (error) { finish(error); }
    }).finally(() => { this.operation = null; });
    return this.operation;
  }
  resume() { return this.control(false); }
  pause() { return this.control(true); }
  mute(value: boolean) { this.gain.gain.value = value ? 0 : 1; }
  async push(samples: Float32Array, rate: number) {
    // Bound total audio, while allowing network delivery to finish during a pause.
    // Provider/network deadlines never wait on the listener's playback timeline.
    this.signal.throwIfAborted();
    if (this.closed) throw new DOMException('Canceled', 'AbortError');
    if (!samples.length) return;
    this.scheduledSeconds += samples.length / rate;
    if (this.scheduledSeconds > 180) throw new Error('Audio limit exceeded');
    const buffer = this.context.createBuffer(1, samples.length, rate);
    buffer.copyToChannel(samples, 0);
    const source = this.context.createBufferSource(); source.buffer = buffer;
    source.connect(this.gain); this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); };
    const at = Math.max(this.end, this.context.currentTime + 0.03);
    const nonzero = samples.findIndex(s => Math.abs(s) > 1 / 32768);
    if (this.firstSound === null && nonzero >= 0) this.firstSound = at + nonzero / rate;
    source.start(at); this.end = at + buffer.duration;
  }
  // This is browser-reported output presentation, not a microphone measurement.
  presentedAt(): number | null {
    if (this.firstSound === null || this.gain.gain.value === 0 || this.context.state !== 'running') return null;
    const stamp = this.context.getOutputTimestamp?.();
    if (!stamp?.contextTime || !stamp.performanceTime || stamp.contextTime < this.firstSound) return null;
    return stamp.performanceTime - (stamp.contextTime - this.firstSound) * 1000;
  }
  async drain() { while (this.sources.size) await this.wait(); }
  private wait() {
    this.signal.throwIfAborted();
    if ((this.pausedAt ?? performance.now()) > this.expires) throw new Error('Playback deadline exceeded');
    return new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Canceled', 'AbortError')); };
      const timer = setTimeout(() => { this.signal.removeEventListener('abort', abort); resolve(); }, 25);
      this.signal.addEventListener('abort', abort, { once: true });
    });
  }
  close() {
    if (this.closed) return; this.closed = true;
    this.signal.removeEventListener('abort', this.abort);
    for (const source of this.sources) { source.onended = null; source.stop(); source.disconnect(); }
    this.sources.clear(); this.gain.disconnect(); void this.context.close().catch(() => {});
  }
}
