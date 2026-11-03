import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api';
import { capabilities, session } from './fixtures';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const auth = { access_token: 'unit-test-token', token_type: 'bearer', expires_in: 3600 };
const next = { ...session, revision: 1, inventory: ['Brass key'], journal: ['Take the brass key'], scene: { ...session.scene, id: 'gallery', chapter: 2 } };
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('real API client', () => {
  it.each([403, 503])('surfaces live restriction or budget denial %s without retries', async status => {
    fetchMock.mockResolvedValueOnce(response({ detail: 'Live narration is restricted or its budget is exhausted.' }, status));
    await expect(new ApiClient().streamAudio(session.id, 0, new AbortController().signal, async () => {}))
      .rejects.toMatchObject({ status, message: 'Live narration is restricted or its budget is exhausted.' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it('checks configured capabilities without creating a story or requesting audio', async () => {
    fetchMock.mockResolvedValueOnce(response(auth)).mockResolvedValueOnce(response(capabilities));
    const client = new ApiClient();
    await expect(client.capabilities(new AbortController().signal)).resolves.toEqual(capabilities);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/auth', '/api/capabilities']);
    fetchMock.mockResolvedValueOnce(response(capabilities)).mockResolvedValueOnce(response(session));
    await client.start('archivist', crypto.randomUUID(), new AbortController().signal);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/auth')).toHaveLength(1);
  });
  it('does not replace an active story identity when landing authentication arrives late', async () => {
    let finish!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const client = new ApiClient();
    const check = client.capabilities(new AbortController().signal);
    fetchMock.mockResolvedValueOnce(response({ ...auth, access_token: 'story-owner' }))
      .mockResolvedValueOnce(response(capabilities)).mockResolvedValueOnce(response(session));
    await client.start('archivist', crypto.randomUUID(), new AbortController().signal);
    fetchMock.mockResolvedValueOnce(response(capabilities));
    finish(response({ ...auth, access_token: 'late-status-owner' })); await check;
    expect(fetchMock.mock.calls.at(-1)?.[1]?.headers).toMatchObject({ Authorization: 'Bearer story-owner' });
  });
  it('surfaces an AssemblyAI configuration error before creating a story', async () => {
    const detail = 'AssemblyAI configuration error: ASSEMBLYAI_API_KEY is missing, empty, or a placeholder. Set a real key on the server or explicitly set VOICE_PROVIDER=mock.';
    fetchMock.mockResolvedValueOnce(response(auth)).mockResolvedValueOnce(response({ detail }, 503));
    await expect(new ApiClient().start('archivist', crypto.randomUUID(), new AbortController().signal))
      .rejects.toMatchObject({ status: 503, message: detail });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/auth', '/api/capabilities']);
  });

  it('validates before network access and refuses a mismatched scene', async () => {
    const client = new ApiClient();
    await expect(client.start('archivist', 'bad-id', new AbortController().signal)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(response({ ...next, id: 'b85a1f97-a317-4f14-8584-7a45d81b189b' }));
    await expect(client.choose(session.id, 'take_key', 0, crypto.randomUUID(), new AbortController().signal)).rejects.toMatchObject({ status: 409 });
  });

  it('rejects internally inconsistent memory and normalizes raw parser errors', async () => {
    fetchMock.mockResolvedValue(response({ ...next, journal: [] }));
    await expect(new ApiClient().refresh(session.id, new AbortController().signal)).rejects.toMatchObject({ status: 502, message: expect.not.stringContaining('journal') });
  });

  it('checks cancellation even when a transport ignores AbortSignal', async () => {
    let done!: (value: Response) => void;
    fetchMock.mockReturnValue(new Promise(resolve => { done = resolve; }));
    const controller = new AbortController();
    const result = new ApiClient().refresh(session.id, controller.signal);
    controller.abort(); done(response(session));
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('does not cache a late auth response after cancellation', async () => {
    let done!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise(resolve => { done = resolve; }));
    const client = new ApiClient(); const controller = new AbortController();
    const result = client.start('archivist', crypto.randomUUID(), controller.signal);
    controller.abort(); done(response(auth));
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    fetchMock.mockResolvedValueOnce(response(auth)).mockResolvedValueOnce(response(capabilities)).mockResolvedValueOnce(response(session));
    await client.start('archivist', crypto.randomUUID(), new AbortController().signal);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/auth')).toHaveLength(2);
  });

  it('preserves rate-limit instructions and validates audio metadata', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Please wait.' }), { status: 429, headers: { 'Retry-After': '60' } }));
    const client = new ApiClient();
    await expect(client.audio(session.id, 0, new AbortController().signal)).rejects.toMatchObject({ retryAfter: 60, status: 429 });
    fetchMock.mockResolvedValueOnce(new Response('wrong audio', { headers: { 'Content-Type': 'audio/wav', 'X-Voice-Mode': 'live' } }));
    await expect(client.audio(session.id, 0, new AbortController().signal)).rejects.toMatchObject({ status: 502 });
  });

  it('turns a timeout into a retryable message', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const result = new ApiClient().refresh(session.id, new AbortController().signal);
    const assertion = expect(result).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(15001); await assertion;
  });
});
