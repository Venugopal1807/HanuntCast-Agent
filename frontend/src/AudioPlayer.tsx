import type { Session } from './contracts';
import { useAudio } from './useAudio';
import { useEffect, useState } from 'react';
import { narrators } from './narrators';

export function AudioPlayer({ session }: { session: Session }) {
  const audio = useAudio(session);
  const available = session.voice_mode !== 'unavailable';
  const live = session.voice_mode === 'live';
  // A recording exists only for this exact scene text and narrator (hash-matched).
  const recorded = !live && Boolean(audio.recording);
  const narrator = narrators.find(n => n.id === session.persona)!;
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    setDelayed(false);
    if (audio.state !== 'loading') return;
    const timer = setTimeout(() => setDelayed(true), 5000);
    return () => clearTimeout(timer);
  }, [audio.state]);

  const source = live ? `Voice / ${narrator.voice}` : recorded ? `AssemblyAI voice / ${narrator.voice} · pre-generated`
    : 'Demo soundscape · optional device voice';
  const pill = live ? 'LIVE TTS' : recorded ? 'ASSEMBLYAI · PRE-GENERATED' : available ? 'MOCK AUDIO' : 'UNAVAILABLE';
  const playingLabel = audio.muted ? (live ? 'Muted · playback continues' : 'Muted · local narration held')
    : live ? 'Playing live narration' : recorded ? `Playing ${narrator.voice} · AssemblyAI-TTS-1` : 'Playing demo audio';
  const status = !available ? 'Audio adapter unavailable' : {
    idle: 'Stopped · Ready when you are',
    loading: live ? 'Connecting live narration...' : recorded ? 'Loading AssemblyAI narration…' : 'Loading mock soundscape…',
    playing: playingLabel,
    paused: audio.muted ? 'Paused · output muted' : 'Paused',
    ended: 'Replay ready',
    error: 'Stopped · Audio needs your attention',
  }[audio.state];
  const playLabel = audio.retrySeconds > 0 ? `Wait ${audio.retrySeconds}s` : audio.state === 'playing' ? 'Ⅱ Pause'
    : audio.state === 'paused' ? '▶ Resume' : audio.state === 'loading' ? 'Loading…'
    : live ? 'Play live narration' : recorded ? `▶ Hear ${narrator.voice} narrate` : '▶ Play demo audio';
  const help = live ? 'Live voice uses credits. Replay uses the completed cache only.'
    : recorded ? `Real AssemblyAI-TTS-1 speech, generated in advance for this exact scene text. Played from a static file: no live request, no credits.`
    : 'Demo audio · no AssemblyAI requests. This scene has no pre-generated recording yet.';

  return <section id="narration" className="audio-panel" aria-label="Narration controls" data-source={live ? 'live' : recorded ? 'pregenerated' : 'mock'}
    data-recording={audio.recording === undefined ? 'checking' : audio.recording ? 'found' : 'none'}>
    <div className="narrator-bar">
      <span className="narrator-mark" aria-hidden="true">{narrator.symbol}</span>
      <div className="narrator-identity"><span className="eyebrow">YOUR NARRATOR</span><strong>{narrator.name}</strong><span>{source}</span></div>
      <span className="mode-pill">{pill}</span>
    </div>
    <div className="listening-state">
      <div className={`waveform ${audio.state === 'playing' && !audio.muted ? 'active' : ''}`} aria-hidden="true">
        {Array.from({ length: 48 }, (_, i) => <i key={i} style={{ height: `${8 + ((i * 17 + 13) % 35)}px`, animationDelay: `${i * 0.05}s` }}/>)}
      </div>
      <p className="audio-status" role="status">{status}</p>
    </div>
    <p className="waveform-caption">Decorative atmosphere · not an audio meter</p>
    {audio.state === 'loading' && <p className="connection-delay" aria-live="polite">{delayed
      ? `Still ${live ? 'connecting' : 'loading'}. You can cancel or continue to the choices.`
      : live ? 'Waiting for the first voice audio. Playback starts as it arrives.'
      : recorded ? 'Loading the recorded narration. You can cancel at any time.' : 'Preparing the local soundscape. You can cancel at any time.'}</p>}
    <p className="playback-help" id="live-audio-help">{help}</p>
    <p className="sr-only" id="playback-semantics">{live
      ? 'Mute silences output; playback continues. Pause stops the playback timeline. Replay is available only after the complete stream is cached.'
      : 'Mute silences the narration and holds local device speech. Pause halts playback.'}</p>
    {audio.error && <p className="error-text" role="alert">{audio.error}</p>}
    <details className="player-diagnostics"><summary>Playback settings & diagnostics</summary><div className="diagnostics-body">
      <p className="fine-print">Deterministic demo story. {live
        ? 'AssemblyAI-TTS-1 streaming. No automatic paid retries. Configured credentials are tested only on playback.'
        : recorded && audio.recording ? `Pre-generated AssemblyAI-TTS-1 recording · voice ${audio.recording.voice} · ${audio.recording.characters} characters · generated ${audio.recording.generated}. Live first-audio latency: — (static file)`
        : 'Original mock soundscape. No AssemblyAI audio. Live first-audio latency: —'}</p>
      {live ? audio.metrics && <p className="fine-print">Browser output: {audio.metrics.outputMs === null ? 'unavailable' : `${Math.round(audio.metrics.outputMs)} ms`} / Server first audio: {Math.round(audio.metrics.serverMs)} ms<br/>Provider session: {audio.metrics.providerId}</p>
        : !recorded && <>
          <label className="narration-toggle"><input type="checkbox" checked={audio.readAloud && audio.hasVoice} disabled={!audio.hasVoice || ['playing', 'paused', 'loading'].includes(audio.state)} onChange={e => audio.setReadAloud(e.target.checked)}/> Read with a local device voice</label>
          {!audio.hasVoice && <p className="fine-print">No local English voice found. The soundscape and transcript are available.</p>}
        </>}
    </div></details>
    <div className="audio-actions">
      <button className="primary play-action" aria-describedby="playback-semantics live-audio-help" disabled={!available || audio.state === 'loading' || audio.retrySeconds > 0} onClick={() => void audio.play()}>{playLabel}</button>
      <button className="icon-button replay-action" disabled={!available || audio.state === 'loading' || audio.retrySeconds > 0 || (live && !audio.canReplay)} onClick={() => void audio.play(true)} aria-label="Replay narration" aria-describedby="playback-semantics">{session.scene.ending ? 'Replay ending' : '↻ Replay'}</button>
      <button className="icon-button" onClick={audio.toggleMute} aria-pressed={audio.muted} aria-describedby="playback-semantics" aria-label={audio.muted ? 'Unmute audio' : 'Mute audio'}>{audio.muted ? 'Unmute' : 'Mute'}</button>
      <button className="cancel-audio" disabled={!['playing', 'paused', 'loading'].includes(audio.state)} onClick={audio.cancel}>Cancel audio</button>
    </div>
    {!session.scene.ending && <a className="audio-choice-link" href="#decisions">Return to choices ↑</a>}
  </section>;
}
