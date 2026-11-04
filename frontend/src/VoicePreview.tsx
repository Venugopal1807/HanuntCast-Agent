import type { Persona } from './contracts';
import type { VoiceSample } from './pregenerated';
import type { useVoicePreview } from './useNarration';

export function SampleButton({ persona, name, voice, sample, preview }: {
  persona: Persona; name: string; voice: string; sample: VoiceSample | undefined; preview: ReturnType<typeof useVoicePreview>;
}) {
  if (!sample) return <span className="sample-missing">Voice sample not yet recorded</span>;
  const active = preview.playing === persona;
  return <span className="voice-sample">
    <button type="button" className="sample-button" aria-pressed={active} aria-label={`${active ? 'Stop' : 'Hear'} a pre-generated AssemblyAI sample of ${name}`}
      onClick={event => { event.preventDefault(); event.stopPropagation(); preview.toggle(persona, sample); }}>
      <span aria-hidden="true">{active ? '■' : '▶'}</span> {active ? 'Stop sample' : `Hear ${voice}`}
    </button>
    <small>{preview.failed === persona ? 'Sample could not play in this browser.' : `Real AssemblyAI-TTS-1 voice · pre-generated · ${sample.voice}`}</small>
  </span>;
}
