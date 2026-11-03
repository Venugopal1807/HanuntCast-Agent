import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioPlayer } from '../AudioPlayer';
import { api } from '../api';
import { session } from './fixtures';

vi.mock('../api', async importOriginal => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, api: { audio: vi.fn() } };
});
beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('audio lifecycle', () => {
  it('aborts on scene change and discards a stale audio result', async () => {
    let resolve!: (blob: Blob) => void;
    vi.mocked(api.audio).mockReturnValue(new Promise(done => { resolve = done; }));
    const AudioMock = vi.fn(); vi.stubGlobal('Audio', AudioMock);
    const { unmount } = render(<AudioPlayer session={session}/>);
    fireEvent.click(screen.getByRole('button', { name: '▶ Play demo audio' }));
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    unmount();
    expect(vi.mocked(api.audio).mock.calls[0][2].aborted).toBe(true);
    await act(async () => resolve(new Blob(['mock'])));
    expect(AudioMock).not.toHaveBeenCalled();
  });

  it('plays, pauses, resumes, mutes, replays and releases object URLs', async () => {
    const revoke = vi.fn(); const originalURL = URL;
    class MockURL extends originalURL { static createObjectURL = vi.fn(() => 'blob:mock'); static revokeObjectURL = revoke; }
    vi.stubGlobal('URL', MockURL);
    const player = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn(),
      volume: 0, muted: false, loop: false, onended: null, onerror: null };
    vi.stubGlobal('Audio', vi.fn(function () { return player; }));
    vi.mocked(api.audio).mockResolvedValue(new Blob(['mock']));
    const { unmount } = render(<AudioPlayer session={session}/>);
    fireEvent.click(screen.getByRole('button', { name: '▶ Play demo audio' }));
    await screen.findByRole('button', { name: /Pause/i });
    fireEvent.click(screen.getByRole('button', { name: /Pause/i }));
    expect(player.pause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Resume/i }));
    await screen.findByRole('button', { name: /Pause/i });
    fireEvent.click(screen.getByRole('button', { name: 'Mute audio' }));
    expect(player.muted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Replay narration' }));
    await waitFor(() => expect(api.audio).toHaveBeenCalledTimes(2));
    await screen.findByRole('button', { name: /Pause/i });
    unmount();
    expect(revoke).toHaveBeenCalled();
    expect(player.removeAttribute).toHaveBeenCalledWith('src');
  });

  it('surfaces a retryable audio error', async () => {
    vi.mocked(api.audio).mockRejectedValue(new Error('Audio unavailable'));
    render(<AudioPlayer session={session}/>);
    fireEvent.click(screen.getByRole('button', { name: '▶ Play demo audio' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Audio could not start');
    expect(screen.getByRole('button', { name: 'Replay narration' })).toBeEnabled();
  });

  it('cancels pending loading immediately without a stale result restarting playback', async () => {
    let resolve!: (value: Blob) => void;
    vi.mocked(api.audio).mockReturnValue(new Promise(done => { resolve = done; }));
    const constructor = vi.fn(); vi.stubGlobal('Audio', constructor);
    render(<AudioPlayer session={session}/>);
    fireEvent.click(screen.getByRole('button', { name: '▶ Play demo audio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel audio' }));
    expect(screen.getByRole('status')).toHaveTextContent('Ready');
    await act(async () => resolve(new Blob(['old'])));
    expect(constructor).not.toHaveBeenCalled();
  });

  it('recovers from an actual play rejection and releases the failed resource', async () => {
    const player = { play: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')),
      pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn(), onerror: null, onended: null };
    vi.stubGlobal('Audio', vi.fn(function () { return player; }));
    vi.mocked(api.audio).mockResolvedValue(new Blob(['mock']));
    render(<AudioPlayer session={session}/>);
    fireEvent.click(screen.getByRole('button', { name: '▶ Play demo audio' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Audio could not start');
    expect(player.removeAttribute).toHaveBeenCalledWith('src');
    player.play.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Replay narration' }));
    await screen.findByRole('button', { name: /Pause/ });
  });

  it('bounds a browser play promise that never settles', async () => {
    vi.useFakeTimers();
    const player = { play: vi.fn(() => new Promise<void>(() => {})), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn() };
    vi.stubGlobal('Audio', vi.fn(function () { return player; }));
    vi.mocked(api.audio).mockResolvedValue(new Blob(['mock']));
    render(<AudioPlayer session={session}/>);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '▶ Play demo audio' })));
    await act(async () => vi.advanceTimersByTimeAsync(10001));
    expect(screen.getByRole('alert')).toHaveTextContent('Audio could not start');
    expect(screen.getByRole('button', { name: 'Replay narration' })).toBeEnabled();
  });

  it('resets playback on a direct scene prop change', async () => {
    const player = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn() };
    vi.stubGlobal('Audio', vi.fn(function () { return player; }));
    vi.mocked(api.audio).mockResolvedValue(new Blob(['mock']));
    const { rerender } = render(<AudioPlayer session={session}/>);
    fireEvent.click(screen.getByRole('button', { name: '▶ Play demo audio' }));
    await screen.findByRole('button', { name: /Pause/ });
    rerender(<AudioPlayer session={{ ...session, revision: 1 }}/>);
    expect(screen.getByRole('status')).toHaveTextContent('Ready');
    expect(player.pause).toHaveBeenCalled();
  });

  it('ignores a late resume promise after Cancel', async () => {
    let resumed!: () => void;
    const player = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn() };
    vi.stubGlobal('Audio', vi.fn(function () { return player; }));
    vi.mocked(api.audio).mockResolvedValue(new Blob(['mock']));
    render(<AudioPlayer session={session}/>);
    fireEvent.click(screen.getByRole('button', { name: '▶ Play demo audio' }));
    await screen.findByRole('button', { name: /Pause/ });
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }));
    player.play.mockReturnValue(new Promise<void>(resolve => { resumed = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel audio' }));
    await act(async () => resumed());
    expect(screen.getByRole('status')).toHaveTextContent('Ready');
  });

  it('cancels local speech and ignores its queued callbacks after replay', async () => {
    class Speech {
      text: string;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) { this.text = text; }
    }
    const spoken: Speech[] = [];
    const synthesis = { getVoices: () => [{ localService: true, lang: 'en-US', default: true }],
      addEventListener: vi.fn(), removeEventListener: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(),
      speak: vi.fn((value: Speech) => spoken.push(value)) };
    vi.stubGlobal('speechSynthesis', synthesis); vi.stubGlobal('SpeechSynthesisUtterance', Speech);
    const player = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn() };
    vi.stubGlobal('Audio', vi.fn(function () { return player; }));
    vi.mocked(api.audio).mockResolvedValue(new Blob(['mock']));
    const { unmount } = render(<AudioPlayer session={session}/>);
    fireEvent.click(screen.getByRole('button', { name: '▶ Play demo audio' }));
    await waitFor(() => expect(spoken).toHaveLength(1));
    const staleError = spoken[0].onerror!; const staleEnd = spoken[0].onend!;
    fireEvent.click(screen.getByRole('button', { name: 'Replay narration' }));
    await waitFor(() => expect(spoken).toHaveLength(2));
    act(() => { staleError(); staleEnd(); });
    expect(screen.getByRole('status')).toHaveTextContent('Playing');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    unmount(); expect(synthesis.cancel).toHaveBeenCalledTimes(2);
  });
});
