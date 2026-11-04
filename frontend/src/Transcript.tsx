import { useEffect, useRef, useState } from 'react';
import type { Session } from './contracts';
import { findRecording } from './pregenerated';

/**
 * Scene text. Expanded automatically when this exact scene has no real AssemblyAI narration
 * (mock fallback), so the story can always be read; collapsed when a recording or live voice
 * exists. Once the reader toggles it, their choice wins for this scene. Never starts audio.
 * Parent remounts it per scene (keyed by session id and revision), which resets the default.
 */
export function Transcript({ session, narratorName, ending }: { session: Session; narratorName: string; ending: boolean }) {
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState(false);
  const touched = useRef(false);
  useEffect(() => {
    let current = true;
    if (session.voice_mode === 'live') { setResolved(true); return; }
    void findRecording(session.persona, session.scene.text).catch(() => null).then(recording => {
      if (!current) return;
      setResolved(true);
      if (!touched.current) setOpen(!recording);
    });
    return () => { current = false; };
  }, [session.persona, session.scene.text, session.voice_mode]);
  return <details className="transcript secondary-panel" open={open} data-default={resolved ? (open ? 'expanded' : 'collapsed') : 'checking'}
    onToggle={event => { const next = event.currentTarget.open; if (next !== open) { touched.current = true; setOpen(next); } }}>
    <summary>{ending ? 'Your ending · read the transcript' : 'Read the scene transcript'}<span>Full narration</span></summary>
    <div className="transcript-body"><p className="eyebrow">{narratorName} / {session.scene.location}</p><p className="narrative">{session.scene.text}</p></div>
  </details>;
}
