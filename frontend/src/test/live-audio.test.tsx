import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioPlayer } from '../AudioPlayer';
import { api } from '../api';
import { session } from './fixtures';
import type { Session } from '../contracts';

const queue = vi.hoisted(() => ({ push: vi.fn().mockResolvedValue(undefined), resume: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn().mockResolvedValue(undefined), close: vi.fn(), mute: vi.fn(), drain: vi.fn().mockResolvedValue(undefined), presentedAt: vi.fn(() => null) }));
vi.mock('../pcm', async original => ({ ...await original<typeof import('../pcm')>(), PCMQueue: class { constructor() { return queue; } } }));
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), api: { streamAudio: vi.fn(), audio: vi.fn() } }));
const live = { ...session, voice_mode: 'live' as const };
const id = '10885144-0d4b-4928-9eff-ef292a352937';
const begin = { type: 'begin', sample_rate: 16000, encoding: 'pcm_s16le', provider_id: id };
const audio = { type: 'audio', audio: 'AQD/fw==' };
const done = { type: 'done', server_first_audio_ms: 21, provider_id: id };
beforeEach(() => { vi.clearAllMocks(); queue.drain.mockResolvedValue(undefined); });
afterEach(() => vi.useRealTimers());

describe('live audio lifecycle', () => {
  it('shows connection-delay feedback and keeps cancellation available', async () => {
    vi.useFakeTimers();
    vi.mocked(api.streamAudio).mockImplementation(() => new Promise(() => {}));
    render(<AudioPlayer session={live}/>);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Play live/ })));
    await act(async () => { await vi.advanceTimersByTimeAsync(5001); });
    expect(screen.getByText(/Still connecting/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel audio' }));
    expect(vi.mocked(api.streamAudio).mock.calls[0][2].aborted).toBe(true);
    expect(screen.queryByText(/Still connecting/)).not.toBeInTheDocument();
  });
  const finalScenes = (['archivist', 'skeptic', 'medium'] as const).flatMap(persona =>
    (['liberation', 'escape', 'inheritance'] as const).map(ending => ({ persona, ending })));

  it.each(finalScenes)('plays and caches the $persona $ending epilogue', async ({ persona, ending }) => {
    vi.mocked(api.streamAudio).mockImplementation(async (_id, _revision, _signal, event) => {
      await event(begin); await event(audio); await event(done);
    });
    const epilogue: Session = { ...live, persona, revision: 4,
      inventory: ["Eleanor's name", 'A promise to Eleanor', 'Unbound ribbon'],
      journal: ["Study the girl's portrait", 'Promise to help the girl', "Untie the girl's ribbon", ending],
      scene: { ...live.scene, id: ending, chapter: 5, ending, choices: [],
        text: `${persona} remembers your promise in the ${ending} epilogue.` } };
    render(<AudioPlayer session={epilogue}/>);
    fireEvent.click(screen.getByRole('button', { name: /Play live/ }));
    await screen.findByText('Replay ready');
    expect(api.streamAudio).toHaveBeenCalledWith(epilogue.id, 4, expect.any(AbortSignal), expect.any(Function));
    fireEvent.click(screen.getByRole('button', { name: 'Replay narration' }));
    await waitFor(() => expect(queue.push).toHaveBeenCalledTimes(2));
    expect(api.streamAudio).toHaveBeenCalledOnce();
    expect(api.audio).not.toHaveBeenCalled();
  });

  it('discards completed scene audio before narrating the next chapter', async () => {
    vi.mocked(api.streamAudio).mockImplementation(async (_id, _revision, _signal, event) => {
      await event(begin); await event(audio); await event(done);
    });
    const { rerender } = render(<AudioPlayer session={live}/>);
    fireEvent.click(screen.getByRole('button', { name: /Play live/ }));
    await screen.findByText('Replay ready');
    const next: Session = { ...live, revision: 1, inventory: ['Brass key'], journal: ['Take the brass key'],
      scene: { ...live.scene, id: 'gallery', chapter: 2, text: 'The brass key warms in your hand.' } };
    rerender(<AudioPlayer session={next}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Play live narration' }));
    await waitFor(() => expect(api.streamAudio).toHaveBeenCalledTimes(2));
    await screen.findByText('Replay ready');
    expect(vi.mocked(api.streamAudio).mock.calls.map(call => call[1])).toEqual([0, 1]);
    expect(api.audio).not.toHaveBeenCalled();
  });

  it('starts before completion and replays a completed scene without synthesis', async () => {
    let finish!: () => void;
    vi.mocked(api.streamAudio).mockImplementation(async (_id, _revision, _signal, event) => {
      await event(begin); await event(audio);
      await new Promise<void>(resolve => { finish = resolve; }); await event(done);
    });
    render(<AudioPlayer session={live}/>);
    expect(screen.getByRole('button', { name: 'Replay narration' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Play live/ }));
    expect(screen.getByRole('button', { name: 'Replay narration' })).toBeDisabled();
    await waitFor(() => expect(queue.push).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status')).toHaveTextContent('Playing live narration');
    expect(screen.queryByText(/Server first audio:/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replay narration' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Replay narration' }));
    expect(api.streamAudio).toHaveBeenCalledOnce();
    await act(async () => finish());
    await screen.findByText(/Server first audio: 21 ms/);
    await screen.findByText('Replay ready');
    fireEvent.click(screen.getByRole('button', { name: 'Replay narration' }));
    await waitFor(() => expect(queue.push).toHaveBeenCalledTimes(2));
    expect(api.streamAudio).toHaveBeenCalledTimes(1); expect(api.audio).not.toHaveBeenCalled();
  });
  it('pauses, resumes, mutes and cancels without opening a second transport', async () => {
    let finish!: () => void;
    queue.drain.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    vi.mocked(api.streamAudio).mockImplementation(async (_id, _revision, _signal, event) => {
      await event(begin); await event(audio); await event(done);
    });
    render(<AudioPlayer session={live}/>);
    fireEvent.click(screen.getByRole('button', { name: /Play live/ }));
    await screen.findByRole('button', { name: /Pause/ });
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }));
    await screen.findByRole('button', { name: /Resume/ }); expect(queue.pause).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    await screen.findByRole('button', { name: /Pause/ }); expect(queue.resume).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Mute audio' })); expect(queue.mute).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('status')).toHaveTextContent('Muted · playback continues');
    expect(queue.pause).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel audio' }));
    expect(vi.mocked(api.streamAudio).mock.calls[0][2].aborted).toBe(true);
    await act(async () => finish());
    expect(screen.getByRole('status')).toHaveTextContent('Ready'); expect(api.streamAudio).toHaveBeenCalledOnce();
  });
  it('preserves validated cooldown and never automatically retries synthesis', async () => {
    vi.useFakeTimers();
    vi.mocked(api.streamAudio).mockImplementation(async (_id, _revision, _signal, event) => {
      await event({ type: 'error', detail: 'Provider busy', retryable: true, retry_after_seconds: 17 });
    });
    render(<AudioPlayer session={live}/>);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Play live/ })));
    expect(screen.getByRole('alert')).toHaveTextContent('Provider busy');
    expect(screen.getByRole('button', { name: 'Wait 17s' })).toBeDisabled();
    expect(api.streamAudio).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(screen.getByRole('button', { name: 'Play live narration' })).toBeEnabled();
    expect(api.streamAudio).toHaveBeenCalledOnce();
  });
  it.each([301, -1, '17', true])('rejects malformed stream cooldown %s', async cooldown => {
    vi.mocked(api.streamAudio).mockImplementation(async (_id, _revision, _signal, event) => {
      await event({ type: 'error', detail: 'Provider busy', retryable: true, retry_after_seconds: cooldown });
    });
    render(<AudioPlayer session={live}/>);
    fireEvent.click(screen.getByRole('button', { name: /Play live/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Live audio interrupted');
    expect(api.streamAudio).toHaveBeenCalledOnce();
    expect(api.audio).not.toHaveBeenCalled();
  });
  it('rejects stale frames after scene change and never falls back on disconnection', async () => {
    let send!: (value: unknown) => Promise<void>;
    let reject!: (reason: unknown) => void;
    vi.mocked(api.streamAudio).mockImplementation(async (_id, _revision, _signal, event) => {
      send = event; await new Promise<void>((_resolve, fail) => { reject = fail; });
    });
    const { rerender } = render(<AudioPlayer session={live}/>);
    fireEvent.click(screen.getByRole('button', { name: /Play live/ }));
    await waitFor(() => expect(api.streamAudio).toHaveBeenCalledOnce());
    rerender(<AudioPlayer session={{ ...live, revision: 1 }}/>);
    await expect(send(audio)).rejects.toThrow('Canceled');
    expect(queue.push).not.toHaveBeenCalled();
    await act(async () => reject(new Error('Network lost')));
    expect(screen.getByRole('status')).toHaveTextContent('Ready');
    fireEvent.click(screen.getByRole('button', { name: /Play live/ }));
    await waitFor(() => expect(api.streamAudio).toHaveBeenCalledTimes(2));
    await act(async () => reject(new Error('Network lost')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Live audio interrupted');
    expect(api.audio).not.toHaveBeenCalled();
  });
});
