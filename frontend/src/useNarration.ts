import { useCallback, useEffect, useRef, useState } from 'react';
import type { Persona } from './contracts';
import { loadManifest, recordingUrl, type VoiceSample } from './pregenerated';

export type Samples = Partial<Record<Persona, VoiceSample>>;

/** Loads the static manifest once: narrator samples and how many scenes have recorded narration. */
export function useNarrationCatalog() {
  const [catalog, setCatalog] = useState<{ samples: Samples; scenes: number }>({ samples: {}, scenes: 0 });
  useEffect(() => {
    let current = true;
    void loadManifest().then(data => { if (current) setCatalog({ samples: data.samples, scenes: Object.keys(data.scenes).length }); });
    return () => { current = false; };
  }, []);
  return catalog;
}

/** One shared preview player; starting a sample stops the previous one. Stops on unmount. */
export function useVoicePreview() {
  const player = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<Persona | null>(null);
  const [failed, setFailed] = useState<Persona | null>(null);
  const stop = useCallback(() => {
    if (player.current) { player.current.onended = null; player.current.onerror = null; player.current.pause(); player.current = null; }
    setPlaying(null);
  }, []);
  useEffect(() => stop, [stop]);
  const toggle = useCallback((persona: Persona, sample: VoiceSample) => {
    const wasPlaying = playing === persona;
    stop(); setFailed(null);
    if (wasPlaying) return;
    const audio = new Audio(recordingUrl(sample)); player.current = audio;
    audio.onended = () => { if (player.current === audio) stop(); };
    audio.onerror = () => { if (player.current === audio) { stop(); setFailed(persona); } };
    setPlaying(persona);
    void audio.play().catch(() => { if (player.current === audio) { stop(); setFailed(persona); } });
  }, [playing, stop]);
  return { playing, failed, toggle, stop };
}
