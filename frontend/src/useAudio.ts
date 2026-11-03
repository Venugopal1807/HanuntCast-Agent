import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import type { Session } from './contracts';
import { z } from 'zod';
import { PCMDecoder, PCMQueue } from './pcm';
import { diagnose } from './diagnostics';

export type Playback = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

// Bound browser decode/play promises; abort them on navigation or Cancel.
function startMedia(player: HTMLAudioElement, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: unknown) => {
      clearTimeout(timer); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(new DOMException('Canceled', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Playback timed out')), 10000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    try { void player.play().then(() => finish(), finish); } catch (error) { finish(error); }
  });
}

export function useAudio(session: Session) {
  const [metrics, setMetrics] = useState<{ outputMs: number | null; serverMs: number; providerId: string } | null>(null);
  const pcm = useRef<PCMQueue | null>(null);
  const cached = useRef<{ key: string; rate: number; chunks: Float32Array[] } | null>(null);
  const [canReplay, setCanReplay] = useState(false);
  const contextBusy = useRef(false);
  const [state, setState] = useState<Playback>('idle');
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [muted, setMuted] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [readAloud, setReadAloud] = useState(true);
  const stateRef = useRef<Playback>('idle');
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const mutedRef = useRef(false);
  const metricAllowed = useRef(true);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const speechDeadline = useRef(0);
  const speechRemaining = useRef(0);
  const speechFallback = useRef<() => void>(() => {});

  const transition = useCallback((next: Playback) => { stateRef.current = next; setState(next); }, []);
  const release = useCallback(() => {
    generation.current += 1;
    pcm.current?.close(); pcm.current = null;
    request.current?.abort(); request.current = null;
    clearTimeout(speechTimer.current);
    if (audio.current) {
      audio.current.onended = null; audio.current.onerror = null;
      audio.current.pause(); audio.current.removeAttribute('src'); audio.current.load(); audio.current = null;
    }
    if (utterance.current) {
      utterance.current.onstart = null; utterance.current.onend = null; utterance.current.onerror = null;
      utterance.current = null; window.speechSynthesis?.cancel();
    }
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  }, []);
  const cancel = useCallback(() => { release(); setError(''); transition('idle'); }, [release, transition]);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const update = () => setVoices(window.speechSynthesis.getVoices().filter(v => v.localService && /^en\b/i.test(v.lang)));
    update(); window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  useEffect(() => { transition('idle'); setError(''); setMetrics(null); setCanReplay(false); cached.current = null; return release; }, [session.id, session.revision, release, transition]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  function holdSpeech() {
    clearTimeout(speechTimer.current);
    speechRemaining.current = Math.max(1, speechDeadline.current - Date.now());
    window.speechSynthesis?.pause();
  }
  function armSpeech(milliseconds: number) {
    clearTimeout(speechTimer.current);
    speechRemaining.current = milliseconds; speechDeadline.current = Date.now() + milliseconds;
    speechTimer.current = setTimeout(speechFallback.current, milliseconds);
  }
  function resumeSpeech() { window.speechSynthesis?.resume(); armSpeech(speechRemaining.current || 5000); }

  async function play(replay = false) {
    if (stateRef.current === 'loading' || Date.now() < retryAt) return;
    // Replay is cache-only in live mode. A fresh paid attempt always uses Play.
    if (session.voice_mode === 'live' && replay && cached.current?.key !== `${session.id}:${session.revision}`) return;
    if (session.voice_mode === 'live' && !replay && pcm.current && ['playing', 'paused'].includes(stateRef.current)) {
      if (contextBusy.current) return;
      contextBusy.current = true;
      const queue = pcm.current; const run = generation.current;
      try {
        if (stateRef.current === 'playing') { await queue.pause(); if (run === generation.current) transition('paused'); }
        else { await queue.resume(); if (run === generation.current) transition('playing'); }
      } catch { if (run === generation.current) { release(); setError('Playback could not resume.'); transition('error'); } }
      finally { contextBusy.current = false; }
      return;
    }
    if (stateRef.current === 'playing' && !replay) {
      audio.current?.pause(); if (utterance.current && !mutedRef.current) holdSpeech();
      transition('paused'); return;
    }
    if (stateRef.current === 'paused' && !replay && audio.current && request.current) {
      const run = generation.current; const player = audio.current;
      transition('loading');
      try {
        await startMedia(player, request.current.signal);
        if (run !== generation.current) return;
        if (!mutedRef.current && utterance.current) resumeSpeech();
        transition('playing');
      } catch {
        if (run !== generation.current) return;
        release(); diagnose('audio_failure', { stage: 'playback' });
        setError('Playback could not resume. Press Replay to try again.'); transition('error');
      }
      return;
    }
    release();
    const run = generation.current;
    const controller = new AbortController(); request.current = controller;
    setError(''); transition('loading');
    if (session.voice_mode === 'live') {
      await playLive(run, controller); return;
    }
    let stage: 'request' | 'playback' = 'request';
    try {
      const blob = await api.audio(session.id, session.revision, controller.signal);
      if (run !== generation.current) return;
      stage = 'playback'; url.current = URL.createObjectURL(blob);
      const player = new Audio(url.current); audio.current = player;
      player.volume = 0.35; player.muted = mutedRef.current;
      const voice = voices.find(v => v.default) ?? voices[0];
      const speak = readAloud && Boolean(voice);
      player.loop = speak;
      player.onended = () => { if (run === generation.current) { release(); transition('ended'); } };
      player.onerror = () => {
        if (run !== generation.current) return;
        release(); diagnose('audio_failure', { stage: 'playback' });
        setError('Your browser could not play the mock audio. Press Replay to retry.'); transition('error');
      };
      await startMedia(player, controller.signal);
      if (run !== generation.current) { player.pause(); return; }
      transition('playing');
      if (speak) {
        const speech = new SpeechSynthesisUtterance(`${session.scene.title} ${session.scene.text}`);
        utterance.current = speech; speech.voice = voice;
        speech.rate = session.persona === 'skeptic' ? 0.95 : 0.85;
        speech.pitch = session.persona === 'medium' ? 1.05 : 0.8;
        speechFallback.current = () => {
          if (run !== generation.current) return;
          clearTimeout(speechTimer.current);
          speech.onstart = null; speech.onend = null; speech.onerror = null;
          utterance.current = null; window.speechSynthesis.cancel(); player.loop = false;
          diagnose('audio_failure', { stage: 'speech' });
          setError('Local narration did not complete. The mock soundscape and story text are still available.');
        };
        speech.onstart = () => {
          if (run !== generation.current) return;
          armSpeech(Math.min(180000, speech.text.split(/\s+/).length * 1000 + 10000));
          if (mutedRef.current || stateRef.current === 'paused') holdSpeech();
        };
        speech.onend = () => { if (run === generation.current) { release(); transition('ended'); } };
        speech.onerror = speechFallback.current;
        armSpeech(5000); window.speechSynthesis.speak(speech);
        if (mutedRef.current) holdSpeech();
      }
    } catch (cause) {
      if (run !== generation.current) return;
      release(); diagnose('audio_failure', { stage });
      if (cause instanceof ApiError && cause.retryAfter) { setClock(Date.now()); setRetryAt(Date.now() + cause.retryAfter * 1000); }
      setError(cause instanceof ApiError ? cause.message : 'Audio could not start. Press Replay to retry, or continue reading.');
      transition('error');
    }
  }

  async function playLive(run: number, controller: AbortController) {
    const requestedAt = performance.now();
    metricAllowed.current = !mutedRef.current;
    let meter: ReturnType<typeof setInterval> | undefined;
    let outputMs: number | null = null;
    const key = `${session.id}:${session.revision}`;
    const saved = cached.current?.key === key ? cached.current : null;
    setMetrics(null);
    try {
      const queue = new PCMQueue(controller.signal); pcm.current = queue;
      queue.mute(mutedRef.current); await queue.resume();
      if (run !== generation.current) { queue.close(); return; }
      if (saved) {
        transition('playing');
        for (const chunk of saved.chunks) await queue.push(chunk, saved.rate);
      } else {
        const decoder = new PCMDecoder(); let rate = 0; let bytes = 0; let complete = false;
        const chunks: Float32Array[] = [];
        meter = setInterval(() => {
          const presented = queue.presentedAt();
          if (metricAllowed.current && presented !== null && outputMs === null && run === generation.current) {
            outputMs = Math.max(0, presented - requestedAt);
            setMetrics(previous => previous ? { ...previous, outputMs } : null);
          }
        }, 25);
        await api.streamAudio(session.id, session.revision, controller.signal, async raw => {
          if (run !== generation.current) throw new DOMException('Canceled', 'AbortError');
          const event = z.discriminatedUnion('type', [
            z.object({ type: z.literal('begin'), sample_rate: z.number().int().min(8000).max(48000), encoding: z.literal('pcm_s16le'), provider_id: z.string().uuid() }),
            z.object({ type: z.literal('audio'), audio: z.string().min(1).max(1400000) }),
            z.object({ type: z.literal('done'), server_first_audio_ms: z.number().finite().nonnegative(), provider_id: z.string().uuid() }),
            z.object({ type: z.literal('error'), detail: z.string().max(500), retryable: z.boolean().default(false),
              retry_after_seconds: z.number().int().min(0).max(300).default(0) }),
          ]).parse(raw);
          if (complete) throw new Error('Audio after completion');
          if (event.type === 'error') throw new ApiError(event.detail, 503, event.retry_after_seconds, event.retryable);
          if (event.type === 'begin') {
            if (rate) throw new Error('Duplicate session configuration');
            rate = event.sample_rate;
          } else if (event.type === 'audio') {
            if (!rate) throw new Error('Missing session configuration');
            const data = Uint8Array.from(atob(event.audio), c => c.charCodeAt(0));
            bytes += data.length; if (bytes > 8640000) throw new Error('Audio limit exceeded');
            const samples = decoder.decode(data); chunks.push(samples);
            await queue.push(samples, rate);
            if (run === generation.current && stateRef.current === 'loading') transition('playing');
          } else {
            if (!rate || !bytes) throw new Error('Empty audio');
            decoder.finish(); complete = true;
            setMetrics({ outputMs, serverMs: event.server_first_audio_ms, providerId: event.provider_id });
          }
        });
        if (run !== generation.current) return;
        if (!complete) throw new Error('Interrupted audio');
        cached.current = { key, rate, chunks };
        setCanReplay(true);
      }
      await queue.drain();
      if (run === generation.current) { release(); transition('ended'); }
    } catch (cause) {
      if (run !== generation.current) return;
      release(); setMetrics(null);
      if (cause instanceof ApiError && cause.retryAfter) { setClock(Date.now()); setRetryAt(Date.now() + cause.retryAfter * 1000); }
      setError((cause instanceof ApiError ? cause.message : 'Live audio interrupted.') +
        (saved ? ' Replay uses cached audio.' : ' Press Play live narration for a new paid attempt. No automatic retry.'));
      transition('error');
    } finally { clearInterval(meter); }
  }

  function toggleMute() {
    const next = !mutedRef.current; mutedRef.current = next; setMuted(next);
    if (next) metricAllowed.current = false;
    pcm.current?.mute(next);
    if (audio.current) audio.current.muted = next;
    if (utterance.current && stateRef.current === 'playing') { if (next) holdSpeech(); else resumeSpeech(); }
  }

  return { state, error, metrics, muted, readAloud, setReadAloud, canReplay, hasVoice: voices.length > 0,
    retrySeconds: Math.max(0, Math.ceil((retryAt - clock) / 1000)), play, cancel, toggleMute };
}
