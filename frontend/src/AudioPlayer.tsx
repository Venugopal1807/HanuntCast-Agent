import type { Session } from './contracts';
import { useAudio } from './useAudio';
import { useEffect, useState } from 'react';
import { narrators } from './narrators';

export function AudioPlayer({ session }: { session: Session }) {
  const audio = useAudio(session);
  const available = session.voice_mode !== 'unavailable';
  const narrator = narrators.find(n => n.id === session.persona)!;
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    setDelayed(false);
    if (audio.state !== 'loading') return;
    const timer = setTimeout(() => setDelayed(true), 5000);
    return () => clearTimeout(timer);
  }, [audio.state]);
  return <section id="narration" className="audio-panel" aria-label="Narration controls">
    <div className="narrator-bar"><span className="narrator-mark" aria-hidden="true">{narrator.symbol}</span><div className="narrator-identity"><span className="eyebrow">YOUR NARRATOR</span><strong>{narrator.name}</strong><span>{session.voice_mode === 'live' ? `Voice / ${narrator.voice}` : 'Demo soundscape · optional device voice'}</span></div><span className="mode-pill">{session.voice_mode === 'live' ? 'LIVE TTS' : available ? 'MOCK AUDIO' : 'UNAVAILABLE'}</span></div>
    <div className="listening-state">
    <div className={`waveform ${audio.state === 'playing' && !audio.muted ? 'active' : ''}`} aria-hidden="true">
      {Array.from({ length: 48 }, (_, i) => <i key={i} style={{ height: `${8 + ((i * 17 + 13) % 35)}px`, animationDelay: `${i * 0.05}s` }}/>) }
    </div>
    <p className="audio-status" role="status">{!available ? 'Audio adapter unavailable' : {
      idle: 'Stopped · Ready when you are', loading: session.voice_mode === 'live' ? 'Connecting live narration...' : 'Loading mock soundscape…', playing: audio.muted ? session.voice_mode === 'live' ? 'Muted · playback continues' : 'Muted · local narration held' : session.voice_mode === 'live' ? 'Playing live narration' : 'Playing demo audio',
      paused: audio.muted ? 'Paused · output muted' : 'Paused', ended: 'Replay ready', error: 'Stopped · Audio needs your attention',
    }[audio.state]}</p>
    </div>
    <p className="waveform-caption">Decorative atmosphere · not an audio meter</p>
    {audio.state === 'loading' && <p className="connection-delay" aria-live="polite">{delayed ? `Still ${session.voice_mode === 'live' ? 'connecting' : 'loading'}. You can cancel or continue to the choices.` : session.voice_mode === 'live' ? 'Waiting for the first voice audio. Playback starts as it arrives.' : 'Preparing the local soundscape. You can cancel at any time.'}</p>}
    <p className="playback-help" id="live-audio-help">{session.voice_mode === 'live' ? 'Live voice uses credits. Replay uses the completed cache only.' : 'Demo audio · no AssemblyAI requests.'}</p>
    <p className="sr-only" id="playback-semantics">{session.voice_mode === 'live' ? 'Mute silences output; playback continues. Pause stops the playback timeline. Replay is available only after the complete stream is cached.' : 'Mute silences the soundscape and holds local narration. Pause halts playback.'}</p>
    {audio.error && <p className="error-text" role="alert">{audio.error}</p>}
    <details className="player-diagnostics"><summary>Playback settings & diagnostics</summary><div className="diagnostics-body">
      <p className="fine-print">Deterministic demo story. {session.voice_mode === 'live' ? 'AssemblyAI-TTS-1 streaming. No automatic paid retries. Configured credentials are tested only on playback.' : 'Original mock soundscape. No AssemblyAI audio. Live first-audio latency: —'}</p>
      {session.voice_mode === 'live' ? audio.metrics && <p className="fine-print">Browser output: {audio.metrics.outputMs === null ? 'unavailable' : `${Math.round(audio.metrics.outputMs)} ms`} / Server first audio: {Math.round(audio.metrics.serverMs)} ms<br/>Provider session: {audio.metrics.providerId}</p> : <>
        <label className="narration-toggle"><input type="checkbox" checked={audio.readAloud && audio.hasVoice} disabled={!audio.hasVoice || ['playing', 'paused', 'loading'].includes(audio.state)} onChange={e => audio.setReadAloud(e.target.checked)}/> Read with a local device voice</label>
        {!audio.hasVoice && <p className="fine-print">No local English voice found. The soundscape and transcript are available.</p>}
      </>}
    </div></details>
    <div className="audio-actions">
      <button className="primary play-action" aria-describedby="playback-semantics live-audio-help" disabled={!available || audio.state === 'loading' || audio.retrySeconds > 0} onClick={() => void audio.play()}>{audio.retrySeconds > 0 ? `Wait ${audio.retrySeconds}s` : audio.state === 'playing' ? 'Ⅱ Pause' : audio.state === 'paused' ? '▶ Resume' : audio.state === 'loading' ? 'Loading…' : session.voice_mode === 'live' ? 'Play live narration' : '▶ Play demo audio'}</button>
      <button className="icon-button replay-action" disabled={!available || audio.state === 'loading' || audio.retrySeconds > 0 || (session.voice_mode === 'live' && !audio.canReplay)} onClick={() => void audio.play(true)} aria-label="Replay narration" aria-describedby="playback-semantics">{session.scene.ending ? 'Replay ending' : '↻ Replay'}</button>
      <button className="icon-button" onClick={audio.toggleMute} aria-pressed={audio.muted} aria-describedby="playback-semantics" aria-label={audio.muted ? 'Unmute audio' : 'Mute audio'}>{audio.muted ? 'Unmute' : 'Mute'}</button>
      <button className="cancel-audio" disabled={!['playing', 'paused', 'loading'].includes(audio.state)} onClick={audio.cancel}>Cancel audio</button>
    </div>
    {!session.scene.ending && <a className="audio-choice-link" href="#decisions">Return to choices ↑</a>}
  </section>;
}
