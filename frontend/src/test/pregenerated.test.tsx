import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioPlayer } from '../AudioPlayer';
import { api } from '../api';
import { findRecording, resetManifestForTests, sceneKey } from '../pregenerated';
import { session } from './fixtures';

vi.mock('../api', async importOriginal => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, api: { audio: vi.fn() } };
});

// Same key the Python pre-generation tool writes (backend/tests/test_pregenerate.py).
const FIXTURE_KEY = '62c92f3660ca3c3a746d02192b032c986482b41bbbe0bad7c79baf8e5617bd0b';
const manifest = {
  version: 1, model: 'assemblyai-tts-1',
  samples: { archivist: { file: 'scenes/a.mp3', voice: 'aai-george', characters: 25, generated: '2026-11-04', text: 'A key waits on the table.' } },
  scenes: { [FIXTURE_KEY]: { file: 'scenes/a.mp3', voice: 'aai-george', characters: 25, generated: '2026-11-04' } },
};
function serve(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => body })));
}

beforeEach(() => resetManifestForTests());
afterEach(() => { vi.unstubAllGlobals(); resetManifestForTests(); });

describe('pre-generated AssemblyAI narration', () => {
  it('hashes persona and exact text identically to the Python tool', async () => {
    expect(await sceneKey('archivist', 'A key waits on the table.')).toBe(FIXTURE_KEY);
  });

  it('only matches the exact narrator and scene text', async () => {
    serve(manifest);
    expect(await findRecording('archivist', session.scene.text)).toMatchObject({ voice: 'aai-george' });
    expect(await findRecording('skeptic', session.scene.text)).toBeNull();
    expect(await findRecording('archivist', session.scene.text + ' ')).toBeNull();
  });

  it('falls back safely when the manifest is missing or invalid', async () => {
    serve({ version: 2 });
    expect(await findRecording('archivist', session.scene.text)).toBeNull();
    resetManifestForTests(); serve(null, false);
    expect(await findRecording('archivist', session.scene.text)).toBeNull();
  });

  it('labels and plays the static recording without calling the audio API', async () => {
    serve(manifest);
    const player = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn(),
      volume: 0, muted: false, preload: '', onended: null as null | (() => void), onerror: null };
    const AudioMock = vi.fn(function () { return player; }); vi.stubGlobal('Audio', AudioMock);
    render(<AudioPlayer session={session}/>);
    const play = await screen.findByRole('button', { name: '▶ Hear George narrate' });
    expect(screen.getByText('ASSEMBLYAI · PRE-GENERATED')).toBeInTheDocument();
    expect(screen.getByText(/generated in advance for this exact scene text/)).toBeInTheDocument();
    fireEvent.click(play);
    await screen.findByRole('button', { name: /Pause/ });
    expect(AudioMock).toHaveBeenCalledWith('/narration/scenes/a.mp3');
    expect(api.audio).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Playing George · AssemblyAI-TTS-1');
    player.onended?.();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Replay ready'));
  });

  it('keeps the mock label when this scene has no recording', async () => {
    serve({ ...manifest, scenes: {} });
    const { container } = render(<AudioPlayer session={session}/>);
    await waitFor(() => expect(container.querySelector('#narration')).toHaveAttribute('data-recording', 'none'));
    expect(screen.getByText('MOCK AUDIO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '▶ Play demo audio' })).toBeInTheDocument();
    expect(screen.queryByText(/PRE-GENERATED/)).not.toBeInTheDocument();
  });
});
