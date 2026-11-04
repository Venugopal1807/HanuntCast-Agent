import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { api, capabilityApi } from '../api';
import type { Session } from '../contracts';
import { capabilities, session } from './fixtures';

vi.mock('../api', async importOriginal => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, capabilityApi: { capabilities: vi.fn() }, api: { start: vi.fn(), choose: vi.fn(), refresh: vi.fn(), audio: vi.fn() } };
});

async function enter() {
  const view = render(<App/>);
  fireEvent.click(screen.getByRole('button', { name: /Start the experience/i }));
  fireEvent.click(screen.getByRole('button', { name: /Enter Blackthorn House/i }));
  await screen.findByRole('heading', { name: session.scene.title });
  return view;
}

describe('experience', () => {
  beforeEach(() => {
    vi.mocked(api.start).mockResolvedValue({ session, capabilities });
    vi.mocked(capabilityApi.capabilities).mockResolvedValue(capabilities);
  });
  it('expands the transcript when a scene has no real narration, keeps the reader in control, and resets per scene', async () => {
    const { resetManifestForTests } = await import('../pregenerated');
    resetManifestForTests(); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => null })));
    vi.mocked(api.choose).mockResolvedValue({ ...session, revision: 1, scene: { ...session.scene, title: 'Next scene', text: 'The gallery waits.' } });
    const { container } = await enter();
    const transcript = () => container.querySelector('.transcript')!;
    await waitFor(() => expect(transcript()).toHaveAttribute('data-default', 'expanded'));
    expect(transcript()).toHaveAttribute('open');
    expect(screen.getByText(session.scene.text)).toBeVisible();
    // Story text comes before the decision.
    expect(transcript().compareDocumentPosition(container.querySelector('#decisions')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('.journal')).not.toHaveAttribute('open');
    expect(container.querySelector('.player-diagnostics')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Read the scene transcript'));
    await waitFor(() => expect(transcript()).not.toHaveAttribute('open'));
    expect(api.audio).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Take the brass key/ }));
    await screen.findByRole('heading', { name: 'Next scene' });
    await waitFor(() => expect(transcript()).toHaveAttribute('open'));
    expect(screen.getByText('The gallery waits.')).toBeVisible();
    vi.unstubAllGlobals(); resetManifestForTests();
  });

  it('keeps the transcript collapsed when real AssemblyAI narration exists, and opening it never plays audio', async () => {
    const { resetManifestForTests, sceneKey } = await import('../pregenerated');
    resetManifestForTests();
    const key = await sceneKey(session.persona, session.scene.text);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ version: 1, model: 'assemblyai-tts-1', samples: {},
      scenes: { [key]: { file: 'scenes/x.mp3', voice: 'aai-george', characters: 25, generated: '2026-11-04' } } }) })));
    const AudioMock = vi.fn(); vi.stubGlobal('Audio', AudioMock);
    const { container } = await enter();
    const transcript = () => container.querySelector('.transcript')!;
    await waitFor(() => expect(transcript()).toHaveAttribute('data-default', 'collapsed'));
    expect(transcript()).not.toHaveAttribute('open');
    expect(await screen.findByText('ASSEMBLYAI · PRE-GENERATED')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Read the scene transcript'));
    await waitFor(() => expect(transcript()).toHaveAttribute('open'));
    expect(screen.getByText(session.scene.text)).toBeVisible();
    expect(AudioMock).not.toHaveBeenCalled();
    expect(api.audio).not.toHaveBeenCalled();
    vi.unstubAllGlobals(); resetManifestForTests();
  });

  it('does not override a reader who toggles before the recording check finishes', async () => {
    const { resetManifestForTests } = await import('../pregenerated');
    resetManifestForTests();
    let answer!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(done => { answer = done; })));
    const { container } = await enter();
    const transcript = () => container.querySelector('.transcript')!;
    expect(transcript()).toHaveAttribute('data-default', 'checking');
    fireEvent.click(screen.getByText('Read the scene transcript'));
    await waitFor(() => expect(transcript()).toHaveAttribute('open'));
    fireEvent.click(screen.getByText('Read the scene transcript'));
    await waitFor(() => expect(transcript()).not.toHaveAttribute('open'));
    await act(async () => answer({ ok: false, json: async () => null }));
    await waitFor(() => expect(transcript()).toHaveAttribute('data-default', 'collapsed'));
    expect(transcript()).not.toHaveAttribute('open');
    vi.unstubAllGlobals(); resetManifestForTests();
  });

  it('keeps the transcript collapsed for live narration', async () => {
    vi.mocked(api.start).mockResolvedValue({ session: { ...session, voice_mode: 'live' }, capabilities: { ...capabilities, voice: 'live', assemblyai_available: true } });
    const { container } = await enter();
    await waitFor(() => expect(container.querySelector('.transcript')).toHaveAttribute('data-default', 'collapsed'));
    expect(container.querySelector('.transcript')).not.toHaveAttribute('open');
  });

  it('shows configured live availability without requesting narration', async () => {
    vi.mocked(capabilityApi.capabilities).mockResolvedValue({ ...capabilities, voice: 'live', assemblyai_available: true });
    render(<App/>);
    expect(await screen.findByText('Live voice ready')).toBeInTheDocument();
    expect(api.start).not.toHaveBeenCalled();
    expect(api.audio).not.toHaveBeenCalled();
  });
  it('does not claim demo availability when the status check fails', async () => {
    vi.mocked(capabilityApi.capabilities).mockRejectedValue(new Error('Offline'));
    render(<App/>);
    expect(await screen.findByText('Voice status unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start the experience/ })).toBeEnabled();
  });
  it('describes configured live narration and its credit cost on landing', () => {
    render(<App/>);
    expect(screen.getByText(/Live AssemblyAI narration when configured \(uses credits\)/)).toBeInTheDocument();
  });

  it.each(['liberation', 'escape', 'inheritance'] as const)('renders the %s ending and restarts', async ending => {
    vi.mocked(api.choose).mockResolvedValue({ ...session, revision: 4, scene: { ...session.scene, title: `Ending ${ending}`, chapter: 5, choices: [], ending } });
    await enter();
    fireEvent.click(screen.getByRole('button', { name: /Take the brass key/i }));
    expect(await screen.findByRole('heading', { name: `Ending ${ending}` })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Playback settings & diagnostics'));
    expect(screen.getByText('Live first-audio latency: —', { exact: false })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Enter again/i }));
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('reuses the decision UUID after a lost response', async () => {
    vi.mocked(api.choose).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({ ...session, revision: 1 });
    await enter();
    fireEvent.click(screen.getByRole('button', { name: /Take the brass key/i }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /Study the portrait/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry safely' }));
    await waitFor(() => expect(api.choose).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(api.choose).mock.calls;
    expect(calls[0].slice(0, 4)).toEqual(calls[1].slice(0, 4));
  });

  it('offers a real pre-generated AssemblyAI sample only for narrators that have one', async () => {
    const { resetManifestForTests } = await import('../pregenerated');
    resetManifestForTests();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ version: 1, model: 'assemblyai-tts-1', scenes: {},
      samples: { medium: { file: 'samples/medium-welcome.wav', voice: 'aai-audrey', characters: 51, generated: '2026-10-29', text: 'Welcome.' } } }) })));
    const player = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), onended: null, onerror: null };
    const AudioMock = vi.fn(function () { return player; }); vi.stubGlobal('Audio', AudioMock);
    render(<App/>);
    expect(await screen.findByText('Public demo · pre-generated AssemblyAI voice')).toBeInTheDocument();
    expect(screen.getByText(/never uses your microphone/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start the experience/i }));
    const sample = screen.getByRole('button', { name: 'Hear a pre-generated AssemblyAI sample of The Medium' });
    expect(screen.queryByRole('button', { name: /sample of The Archivist/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('Voice sample not yet recorded')).toHaveLength(2);
    fireEvent.click(sample);
    expect(AudioMock).toHaveBeenCalledWith('/narration/samples/medium-welcome.wav');
    expect(await screen.findByRole('button', { name: 'Stop a pre-generated AssemblyAI sample of The Medium' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Enter Blackthorn House/i }));
    await screen.findByRole('heading', { name: session.scene.title });
    expect(player.pause).toHaveBeenCalled();
    vi.unstubAllGlobals(); resetManifestForTests();
  });

  it('explains a carried-over rate-limit wait after restarting instead of silently disabling Enter', async () => {
    const { ApiError } = await vi.importActual<typeof import('../api')>('../api');
    vi.mocked(api.start).mockRejectedValueOnce(new ApiError('Too many requests. Please wait before retrying.', 429, 60));
    render(<App/>);
    fireEvent.click(screen.getByRole('button', { name: /Start the experience/i }));
    fireEvent.click(screen.getByRole('button', { name: /Enter Blackthorn House/i }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Return to character selection' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const enter = screen.getByRole('button', { name: /Wait \d+s/ });
    expect(enter).toBeDisabled();
    expect(screen.getByText(/The house asked us to wait/)).toBeInTheDocument();
  });

  it('ignores a late story response after leaving', async () => {
    let resolve!: (value: Session) => void;
    vi.mocked(api.choose).mockReturnValue(new Promise(done => { resolve = done; }));
    await enter();
    fireEvent.click(screen.getByRole('button', { name: /Take the brass key/i }));
    fireEvent.click(screen.getByRole('button', { name: /Leave experience/i }));
    await act(async () => resolve({ ...session, revision: 1, scene: { ...session.scene, title: 'Stale scene' } }));
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Stale scene' })).not.toBeInTheDocument();
  });
});
