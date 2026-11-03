import { z } from 'zod';
import { AuthSchema, CapabilitiesSchema, ChoiceRequestSchema, SessionSchema, StartSchema, type Persona } from './contracts';
import { diagnose } from './diagnostics';

export class ApiError extends Error {
  constructor(message: string, public status: number, public retryAfter: number = 0, public retryable: boolean = false) { super(message); }
}

export class ApiClient {
  private token: string | null = null;

  async capabilities(signal: AbortSignal) {
    if (!this.token) {
      const token = await this.request('/auth', async r => AuthSchema.parse(await r.json()).access_token, { method: 'POST' }, signal);
      signal.throwIfAborted();
      this.token ??= token;
    }
    return this.request('/capabilities', async r => CapabilitiesSchema.parse(await r.json()), {}, signal);
  }

  private async request<T>(path: string, consume: (response: Response) => Promise<T>, init: RequestInit = {}, signal?: AbortSignal, deadline = 15000): Promise<T> {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(cancel, deadline);
    const sentToken = this.token;
    let status = 0;
    let requestId: string | undefined;
    try {
      signal?.throwIfAborted();
      const response = await fetch(`/api${path}`, {
        ...init, signal: controller.signal,
        headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
      });
      status = response.status;
      requestId = response.headers.get('X-Request-ID') ?? undefined;
      if (!response.ok) {
        const parsed = z.object({ detail: z.string() }).safeParse(await response.json().catch(() => null));
        if (response.status === 401 && this.token === sentToken) this.token = null;
        const seconds = Number(response.headers.get('Retry-After'));
        throw new ApiError(parsed.success ? parsed.data.detail : `Request failed (${response.status}). Please retry.`,
          response.status, Number.isFinite(seconds) ? Math.min(300, Math.max(0, seconds)) : 0);
      }
      const result = await consume(response);
      controller.signal.throwIfAborted();
      return result;
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Canceled', 'AbortError');
      diagnose('api_failure', { status, requestId, stage: error instanceof z.ZodError ? 'contract' : 'request' });
      if (controller.signal.aborted && !signal?.aborted) throw new ApiError('The house is taking too long to respond. Please retry.', 408);
      if (error instanceof ApiError) throw error;
      if (error instanceof z.ZodError || error instanceof SyntaxError) throw new ApiError('The server returned an unexpected scene. Please retry or start a new experience.', 502);
      throw new ApiError('The house could not be reached. Check that the backend is running, then retry.', 0);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  }

  async start(persona: Persona, requestId: string, signal: AbortSignal) {
    const body = StartSchema.parse({ persona, request_id: requestId });
    if (!this.token) {
      const token = await this.request('/auth', async r => AuthSchema.parse(await r.json()).access_token, { method: 'POST' }, signal);
      signal.throwIfAborted();
      this.token ??= token;
    }
    const capabilities = await this.request('/capabilities', async r => CapabilitiesSchema.parse(await r.json()), {}, signal);
    const session = await this.request('/sessions', async r => SessionSchema.parse(await r.json()), { method: 'POST', body: JSON.stringify(body) }, signal);
    if (session.persona !== persona || session.voice_mode !== capabilities.voice) throw new ApiError('The server returned an inconsistent story. Please start again.', 502);
    return { session, capabilities };
  }

  async choose(id: string, choiceId: string, revision: number, requestId: string, signal: AbortSignal) {
    const body = ChoiceRequestSchema.parse({ choice_id: choiceId, revision, request_id: requestId });
    z.string().uuid().parse(id);
    return this.request(`/sessions/${id}/choices`, async r => {
      const next = SessionSchema.parse(await r.json());
      if (next.id !== id || next.revision !== revision + 1) throw new ApiError('The story response belongs to another scene. Refresh the current scene.', 409);
      return next;
    }, { method: 'POST', body: JSON.stringify(body) }, signal);
  }

  async refresh(id: string, signal: AbortSignal) {
    z.string().uuid().parse(id);
    return this.request(`/sessions/${id}`, async r => {
      const next = SessionSchema.parse(await r.json());
      if (next.id !== id) throw new ApiError('The server returned another story. Please start again.', 502);
      return next;
    }, {}, signal);
  }

  async streamAudio(id: string, revision: number, signal: AbortSignal, consume: (event: unknown) => Promise<void>) {
    z.string().uuid().parse(id);
    return this.request(`/sessions/${id}/audio/stream?revision=${revision}&request_id=${crypto.randomUUID()}`, async response => {
      if (response.headers.get('X-Voice-Mode') !== 'live' || !response.headers.get('Content-Type')?.includes('application/x-ndjson') || !response.body) {
        throw new ApiError('Invalid live stream response.', 502);
      }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = '';
      try {
        for (;;) {
          signal.throwIfAborted();
          const { value, done } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          if (pending.length > 1500000) throw new ApiError('Audio frame exceeds buffer limit.', 502);
          let boundary: number;
          while ((boundary = pending.indexOf('\n')) >= 0) {
            const line = pending.slice(0, boundary); pending = pending.slice(boundary + 1);
            signal.throwIfAborted(); await consume(JSON.parse(line));
          }
        }
        if (pending.trim()) throw new ApiError('Audio stream was truncated.', 502);
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    }, { method: 'POST' }, signal, 180000);
  }

  async audio(id: string, revision: number, signal: AbortSignal) {
    return this.request(`/sessions/${id}/audio?revision=${revision}`, async response => {
      if (response.headers.get('X-Voice-Mode') !== 'mock' || !response.headers.get('Content-Type')?.includes('audio/wav')) {
        throw new ApiError('The audio response was not a verified mock WAV.', 502);
      }
      return response.blob();
    }, {}, signal);
  }
}

export const api = new ApiClient();
// Share the bootstrap identity with Start; first-set-wins protects ownership
// if the user enters while an initial capabilities check is still pending.
export const capabilityApi = api;
