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
  it('keeps transcript, journal and diagnostics secondary and resets disclosure on a new scene', async () => {
    vi.mocked(api.choose).mockResolvedValue({ ...session, revision: 1, scene: { ...session.scene, title: 'Next scene' } });
    const { container } = await enter();
    expect(container.querySelector('.transcript')).not.toHaveAttribute('open');
    expect(container.querySelector('.journal')).not.toHaveAttribute('open');
    expect(container.querySelector('.player-diagnostics')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Read the scene transcript'));
    expect(screen.getByText(session.scene.text)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Take the brass key/ }));
    await screen.findByRole('heading', { name: 'Next scene' });
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
