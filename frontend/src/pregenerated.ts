import { z } from 'zod';
import type { Persona } from './contracts';

// Pre-generated AssemblyAI-TTS-1 narration served as static files. Nothing here calls a
// provider: recordings were synthesized once, offline, under an explicit budget ledger.
// Scene audio is keyed by SHA-256 of `${persona}\n${exact scene text}`, so a recording can
// only ever play for the precise prose it speaks.
const Entry = z.object({
  file: z.string().regex(/^[a-z0-9][a-z0-9/_.-]*\.(mp3|wav)$/),
  voice: z.enum(['aai-george', 'aai-jane', 'aai-audrey']),
  characters: z.number().int().positive(),
  generated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();
const Sample = Entry.extend({ text: z.string().min(1).max(1500) }).strict();
const Manifest = z.object({
  version: z.literal(1), model: z.literal('assemblyai-tts-1'),
  samples: z.record(z.enum(['archivist', 'skeptic', 'medium']), Sample).default({}),
  scenes: z.record(z.string().regex(/^[0-9a-f]{64}$/), Entry).default({}),
}).strict();
export type Recording = z.infer<typeof Entry>;
export type VoiceSample = z.infer<typeof Sample>;
type ManifestData = z.infer<typeof Manifest>;

const BASE = '/narration/';
const empty: ManifestData = { version: 1, model: 'assemblyai-tts-1', samples: {}, scenes: {} };
let manifest: Promise<ManifestData> | null = null;

export function loadManifest(): Promise<ManifestData> {
  manifest ??= fetch(`${BASE}manifest.json`, { cache: 'no-cache' })
    .then(async response => response.ok ? Manifest.parse(await response.json()) : empty)
    .catch(() => empty); // Missing or invalid manifest: fall back to the labeled mock path.
  return manifest;
}

export function resetManifestForTests() { manifest = null; }

export async function sceneKey(persona: Persona, text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${persona}\n${text}`));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function findRecording(persona: Persona, text: string): Promise<Recording | null> {
  const [data, key] = await Promise.all([loadManifest(), sceneKey(persona, text)]);
  return data.scenes[key] ?? null;
}

export async function voiceSamples(): Promise<Partial<Record<Persona, VoiceSample>>> {
  return (await loadManifest()).samples;
}

export const recordingUrl = (entry: Recording) => BASE + entry.file;
