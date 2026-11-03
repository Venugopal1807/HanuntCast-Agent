import { describe, expect, it } from 'vitest';
import { ChoiceRequestSchema, SessionSchema, StartSchema } from '../contracts';
import { session } from './fixtures';

describe('API boundary validation', () => {
  it('accepts the documented demo response', () => expect(SessionSchema.parse(session)).toEqual(session));
  it('rejects narration that cannot fit the single-request voice budget', () => {
    for (const text of ['', 'x'.repeat(1501)]) {
      expect(SessionSchema.safeParse({ ...session, scene: { ...session.scene, text } }).success).toBe(false);
    }
    expect(SessionSchema.safeParse({ ...session, scene: { ...session.scene, text: 'x'.repeat(1500) } }).success).toBe(true);
  });
  it('rejects fabricated live status and invalid inputs', () => {
    expect(SessionSchema.safeParse({ ...session, voice_mode: 'assemblyai' }).success).toBe(false);
    expect(StartSchema.safeParse({ persona: 'invented', request_id: crypto.randomUUID() }).success).toBe(false);
    expect(ChoiceRequestSchema.safeParse({ choice_id: 'take_key', revision: '0', request_id: crypto.randomUUID() }).success).toBe(false);
    expect(ChoiceRequestSchema.safeParse({ choice_id: 'take_key', revision: 0, request_id: 'bad' }).success).toBe(false);
  });
});
