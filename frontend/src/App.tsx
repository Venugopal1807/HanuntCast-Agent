import { useEffect, useRef, useState } from 'react';
import { api, ApiError, capabilityApi } from './api';
import type { Persona, Session } from './contracts';
import { AudioPlayer } from './AudioPlayer';
import { Mansion } from './Mansion';
import { SceneArt } from './SceneArt';
import { narrators as personas } from './narrators';
import { SampleButton } from './VoicePreview';
import { Transcript } from './Transcript';
import { useNarrationCatalog, useVoicePreview } from './useNarration';

type Pending = { kind: 'start'; persona: Persona; requestId: string } | { kind: 'choice'; choice: string; revision: number; requestId: string; sessionId: string } | { kind: 'refresh'; sessionId: string };
const endings = {
  liberation: { number: 'I', label: 'LIBERATION', subtitle: 'Some stories end when someone finally listens.' },
  escape: { number: 'II', label: 'THE SURVIVOR', subtitle: 'You left the house. Did the house leave you?' },
  inheritance: { number: 'III', label: 'THE INHERITANCE', subtitle: 'Every haunted house begins with someone who stays.' },
};

export default function App() {
  const [voiceMode, setVoiceMode] = useState<'checking' | 'unknown' | Session['voice_mode']>('checking');
  useEffect(() => {
    const check = new AbortController();
    void capabilityApi.capabilities(check.signal).then(result => {
      if (!check.signal.aborted) setVoiceMode(result.voice);
    }).catch(() => { if (!check.signal.aborted) setVoiceMode('unknown'); });
    return () => check.abort();
  }, []);
  const [page, setPage] = useState<'landing' | 'personas' | 'story'>('landing');
  const [persona, setPersona] = useState<Persona>('archivist');
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(0);
  const [retryAt, setRetryAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [pending, setPending] = useState<Pending | null>(null);
  const operation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const busyRef = useRef(false);
  const catalog = useNarrationCatalog();
  const preview = useVoicePreview();
  const { stop: stopPreview } = preview;
  useEffect(() => { if (page !== 'personas') stopPreview(); }, [page, stopPreview]);

  useEffect(() => () => { operation.current += 1; controller.current?.abort(); }, []);
  useEffect(() => {
    if (page === 'landing') return;
    heading.current?.focus({ preventScroll: true });
    (heading.current?.closest('.story-page') ?? heading.current)?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }, [page, session?.revision]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  async function execute(action: Pending) {
    if (busyRef.current || Date.now() < retryAt) return;
    busyRef.current = true; controller.current?.abort(); controller.current = new AbortController();
    const signal = controller.current.signal; const run = ++operation.current;
    setPending(action); setBusy(true); setError(''); setErrorStatus(0);
    try {
      let next: Session;
      if (action.kind === 'start') next = (await api.start(action.persona, action.requestId, signal)).session;
      else if (action.kind === 'choice') next = await api.choose(action.sessionId, action.choice, action.revision, action.requestId, signal);
      else next = await api.refresh(action.sessionId, signal);
      if (run !== operation.current || signal.aborted) return;
      setSession(current => current?.id === next.id && current.revision > next.revision ? current : next);
      setPage('story'); setPending(null); setRetryAt(0);
    } catch (cause) {
      if (run !== operation.current || signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'The connection was lost. Please retry.');
      if (cause instanceof ApiError) { setErrorStatus(cause.status); setClock(Date.now()); setRetryAt(Date.now() + cause.retryAfter * 1000); }
    } finally { if (run === operation.current) { setBusy(false); busyRef.current = false; } }
  }

  function restart() {
    operation.current += 1; controller.current?.abort(); busyRef.current = false;
    setSession(null); setBusy(false); setPending(null); setError(''); setErrorStatus(0); setPage('personas');
  }

  const waitSeconds = Math.max(0, Math.ceil((retryAt - clock) / 1000));
  const selected = personas.find(p => p.id === persona)!;
  const mode = session?.voice_mode ?? voiceMode;
  const capabilityLabel = mode === 'live' ? 'Live voice ready' : mode === 'mock' ? (catalog.scenes || Object.keys(catalog.samples).length ? 'Public demo · pre-generated AssemblyAI voice' : 'Demo mode · mock audio') : mode === 'checking' ? 'Checking voice status' : 'Voice status unavailable';
  const sampleCount = Object.keys(catalog.samples).length;
  const audioNote = mode === 'live' ? 'Live AssemblyAI-TTS-1 narration streams as you listen (uses credits).'
    : catalog.scenes ? `Narration was generated in advance with AssemblyAI-TTS-1 and is labeled as pre-generated; scenes without a recording use a labeled demo soundscape. Live AssemblyAI narration when configured (uses credits).`
    : sampleCount ? 'Hear real, pre-generated AssemblyAI-TTS-1 voice samples on the narrator cards. Scenes use a labeled demo soundscape. Live AssemblyAI narration when configured (uses credits).'
    : 'Live AssemblyAI narration when configured (uses credits). Free mock audio mode available.';
  const ending = session?.scene.ending ? endings[session.scene.ending] : null;
  const errorPanel = error && <div className="error-panel" role="alert"><p>{error}</p><div className="flex gap-3 flex-wrap mt-3">
    {errorStatus === 401 || errorStatus === 404 ? <button onClick={restart}>Start a new experience</button> : errorStatus === 409 && session ? <button disabled={busy || waitSeconds > 0} onClick={() => void execute({ kind: 'refresh', sessionId: session.id })}>Refresh current scene</button> : <button disabled={busy || waitSeconds > 0} onClick={() => pending && void execute(pending)}>{waitSeconds > 0 ? `Retry in ${waitSeconds}s` : 'Retry safely'}</button>}
    <button onClick={restart}>Return to character selection</button>
  </div></div>;

  return <div className="app-shell" data-page={page}>
    <a className="skip-link" href="#main">Skip to experience</a>
    <header className="site-header"><a className="brand" href="/" aria-label="HauntCast AI home"><span className="brand-mark" aria-hidden="true">◧</span> HAUNTCAST <span className="brand-ai">AI</span></a><span className="capability-badge" data-mode={mode} aria-live="polite"><i aria-hidden="true"/>{capabilityLabel}</span></header>
    <main id="main">
      {page === 'landing' && <>
        <section className="hero" aria-labelledby="house-title"><div className="hero-art" aria-hidden="true"><Mansion/><div className="mist"/></div><div className="hero-copy"><p className="eyebrow">A HAUNTCAST ORIGINAL / VOL. 01</p><h1 id="house-title">BLACKTHORN<br/><em>HOUSE</em></h1><p className="hero-tagline">Every ending has a voice.</p><p className="hero-description">An interactive horror story told aloud by AI voices.<br/>Choose your narrator. Listen. Make four decisions. Hear your ending.</p><div className="hero-invitation"><span aria-hidden="true">✧</span> Empty for forty years. Tonight, the light is on.</div><div className="landing-action"><button className="primary wide" onClick={() => setPage('personas')}>Start the experience <span aria-hidden="true">↗</span></button><p>Headphones recommended · Fictional suspense · No jump scares</p></div></div></section>
        <ol className="how-it-works" aria-label="How it works"><li><strong>Choose a narrator</strong><span>Three AssemblyAI voices, three ways to tell it.</span></li><li><strong>Listen, then decide</strong><span>Every chapter has audio and a full transcript. Four decisions shape the night.</span></li><li><strong>Hear your ending</strong><span>Three endings, 189 personalized epilogues.</span></li></ol>
        <p className="landing-mode-note">{audioNote} You choose by tapping or clicking; the app never uses your microphone. Full transcripts are always available.</p>
      </>}
      {page === 'personas' && <section className="selection-page" aria-busy={busy}>
        <button className="text-button back-link" onClick={() => { restart(); setPage('landing'); }}>← Back to the entrance</button>
        <p className="eyebrow">01 / CHOOSE YOUR NARRATOR</p><h1 ref={heading} tabIndex={-1}>Who tells <em>your story?</em></h1><p className="intro">One house. Three ways to hear it. Choose the voice that follows you inside.</p>
        <div className="persona-grid" role="radiogroup" aria-label="Narrative personality">{personas.map((p, index) => <label key={p.id} className={`persona-card ${persona === p.id ? 'selected' : ''}`}><input type="radio" name="persona" value={p.id} aria-label={p.name} checked={persona === p.id} disabled={busy} onChange={() => { setPersona(p.id); setError(''); setPending(null); }}/><span className="persona-number">0{index + 1} / NARRATOR</span><span className="persona-symbol" aria-hidden="true">{p.symbol}</span><h2>{p.name}</h2><span className="persona-role">{p.role}</span><p>{p.description}</p><blockquote>{p.sample}</blockquote><span className="voice-badge">AssemblyAI voice / {p.voice}</span><SampleButton persona={p.id} name={p.name} voice={p.voice} sample={catalog.samples[p.id]} preview={preview}/><span className="selection-indicator">{persona === p.id ? '● SELECTED' : '○ CHOOSE NARRATOR'}</span></label>)}</div>
        <p className="fine-print selection-note">{selected.name} will remember your choices. George, Jane and Audrey are AssemblyAI-TTS-1 voices. Recorded narration is labeled pre-generated; anything else is a labeled demo soundscape.</p>
        {errorPanel}
        {!error && waitSeconds > 0 && <p className="fine-print wait-note" role="status">The house asked us to wait before another request. Entry unlocks in {waitSeconds}s.</p>}
        <div className="bottom-action"><button className="primary wide" disabled={busy || waitSeconds > 0} onClick={() => void execute({ kind: 'start', persona, requestId: pending?.kind === 'start' && pending.persona === persona ? pending.requestId : crypto.randomUUID() })}>{busy ? 'Opening the gates…' : waitSeconds > 0 ? `Wait ${waitSeconds}s` : 'Enter Blackthorn House'} <span aria-hidden="true">→</span></button></div>
      </section>}
      {page === 'story' && session && <section className="story-page" aria-busy={busy}>
        <div className="story-topline"><span className="eyebrow">BLACKTHORN HOUSE / {ending ? 'EPILOGUE' : `CHAPTER 0${session.scene.chapter}`}</span><nav aria-label="Scene controls"><a className="audio-shortcut text-button" href="#narration">Listen ↓</a><button className="text-button" onClick={restart}>Leave experience ↗</button></nav></div>
        <div className="chapter-track" aria-label={`Chapter ${session.scene.chapter} of 5`}>{['Threshold', 'Gallery', 'Belfry', 'Reckoning', 'Aftermath'].map((name, i) => <span key={name} aria-current={i + 1 === session.scene.chapter ? 'step' : undefined} className={i + 1 <= session.scene.chapter ? 'reached' : ''}><i aria-hidden="true"/> <span>{name}</span></span>)}</div>
        <div className="listening-dock">
          {!busy ? <AudioPlayer key={`${session.id}:${session.revision}`} session={session}/> : <div className="audio-panel turning-page" role="status">Narration stopped · turning the page…</div>}
        </div>
        <div className={`story-layout ${ending ? 'is-ending' : ''}`} key={`${session.id}:${session.revision}`}>
          <article className="story-content"><div data-scene={session.scene.id} className={`scene-card ${ending ? 'ending-card' : ''}`}><div className="scene-art" aria-hidden="true"><SceneArt scene={session.scene.id}/></div><div className="scene-heading">
            {ending && <div className="ending-seal">{ending.number}<span>ENDING DISCOVERED / {ending.label}</span></div>}
            <p className="eyebrow">{ending ? 'YOUR STORY HAS LEFT ITS MARK' : session.scene.location.toUpperCase()}</p><h1 ref={heading} tabIndex={-1}>{session.scene.title}</h1>
            {ending && <p className="ending-quote">{ending.subtitle}</p>}
            </div></div>{errorPanel}
            <Transcript session={session} ending={Boolean(ending)} narratorName={personas.find(p => p.id === session.persona)?.name ?? ''}/>
            {!ending && <div id="decisions" className="choices"><p className="eyebrow">WHAT DO YOU DO? <span>THE HOUSE WILL REMEMBER.</span></p>{session.scene.choices.map((choice, index) => <button key={choice.id} disabled={busy || Boolean(pending) || waitSeconds > 0} onClick={() => void execute({ kind: 'choice', choice: choice.id, revision: session.revision, requestId: crypto.randomUUID(), sessionId: session.id })}><span className="choice-number">0{index + 1}</span><span><strong>{choice.label}</strong><small>{choice.hint}</small></span><span className="choice-arrow" aria-hidden="true">↗</span></button>)}<p className="transition-status" role="status">{busy ? 'The house is remembering your decision…' : 'You can choose at any time. Audio stops when the scene changes.'}</p></div>}
          </article>
          <aside className="story-sidebar" aria-label="Remembered decisions">
            <details className="journal secondary-panel"><summary>{ending ? 'Your path remembered' : 'Discoveries & decision journal'}<span>{session.journal.length} choices</span></summary><div className="journal-body"><p className="eyebrow">THE HOUSE REMEMBERS</p><h2>Your traces</h2>{session.inventory.length ? <ul>{session.inventory.map(item => <li key={item}><span aria-hidden="true">◇</span>{item}</li>)}</ul> : <p className="fine-print">Nothing yet. Every decision leaves something behind.</p>}<h3>Decision journal</h3>{session.journal.length ? <ol>{session.journal.map((item, i) => <li key={i}>{item}</li>)}</ol> : <p>Your first choice awaits.</p>}</div></details>
            {ending && <div className="remembered-summary"><div className="turning-point"><span className="eyebrow">THE TURNING POINT / IN THE BELFRY</span><strong>{session.journal[2] ?? session.journal.at(-1)}</strong><p>{session.scene.ending === 'liberation' ? 'You broke the anchor. You chose to guide her out.' : session.scene.ending === 'escape' ? 'You chose to leave. The house keeps the echoes.' : 'You accepted the keeper’s place. The house remembers.'}</p></div><p>{session.journal.length} decisions remembered · {personas.find(p => p.id === session.persona)?.name}</p><p>{session.journal.join(' → ')}</p></div>}
          </aside>
        </div>
        {ending && <div className="bottom-action"><p className="fine-print text-center mb-4">Keep a screenshot of your ending. Two other endings are waiting.</p><button className="primary wide" onClick={restart}>Enter again. Choose differently. <span aria-hidden="true">↻</span></button></div>}
      </section>}
    </main>
    <footer className="site-footer"><span>HAUNTCAST AI <span className="muted">/ EVERY ENDING HAS A VOICE</span></span><span>Original interactive fiction · Choices remembered</span></footer>
  </div>;
}
