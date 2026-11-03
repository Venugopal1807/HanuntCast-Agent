// Deliberately accept only allowlisted metadata. Never log errors, text, tokens or URLs.
export type Diagnostic = 'api_failure' | 'audio_failure' | 'render_failure' | 'window_failure';
type Metadata = { status?: number; stage?: 'request' | 'contract' | 'playback' | 'speech' | 'render'; requestId?: string };

export function diagnose(event: Diagnostic, metadata: Metadata = {}) {
  console.warn('[HauntCast]', JSON.stringify({
    event, stage: metadata.stage, status: metadata.status,
    requestId: metadata.requestId && /^[0-9a-f-]{36}$/i.test(metadata.requestId) ? metadata.requestId : undefined,
  }));
}
