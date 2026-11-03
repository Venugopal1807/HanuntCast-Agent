import type { Session } from '../contracts';

export const session: Session = {
  id: '28c7a1f1-c098-49eb-a7e5-c497aee93cd6', persona: 'archivist', revision: 0,
  inventory: [], journal: [], story_mode: 'deterministic-demo', voice_mode: 'mock',
  scene: { id: 'threshold', chapter: 1, location: 'The entrance hall', title: 'Someone left the light on.',
    text: 'A key waits on the table.', ending: null,
    choices: [{ id: 'take_key', label: 'Take the brass key', hint: 'A way further in.' },
      { id: 'study_portrait', label: 'Study the portrait', hint: 'Learn her name.' }] },
};
export const capabilities = { story: 'deterministic-demo' as const, voice: 'mock' as const,
  assemblyai_available: false as const, live_ttfa_ms: null, reason: 'Unverified protocol.' };
