import { z } from 'zod';

export const PersonaSchema = z.enum(['archivist', 'skeptic', 'medium']);
export type Persona = z.infer<typeof PersonaSchema>;
export const StartSchema = z.object({ persona: PersonaSchema, request_id: z.string().uuid() }).strict();
export const ChoiceRequestSchema = z.object({
  choice_id: z.string().min(1).max(40).regex(/^[a-z_]+$/), revision: z.number().int().min(0).max(10), request_id: z.string().uuid(),
}).strict();
export const SceneSchema = z.object({
  id: z.enum(['threshold', 'gallery', 'belfry', 'reckoning', 'liberation', 'escape', 'inheritance']),
  chapter: z.number().int().min(1).max(5), location: z.string().min(1), title: z.string().min(1), text: z.string().min(1).max(1500),
  choices: z.array(z.object({ id: z.string().regex(/^[a-z_]+$/), label: z.string().min(1), hint: z.string().min(1) }).strict()).max(3),
  ending: z.enum(['liberation', 'escape', 'inheritance']).nullable(),
}).strict().superRefine((scene, ctx) => {
  const chapters = { threshold: 1, gallery: 2, belfry: 3, reckoning: 4, liberation: 5, escape: 5, inheritance: 5 };
  const isEnding = scene.chapter === 5;
  if (chapters[scene.id] !== scene.chapter || (isEnding ? scene.ending !== scene.id || scene.choices.length !== 0 : scene.ending !== null || scene.choices.length < 2)
    || new Set(scene.choices.map(c => c.id)).size !== scene.choices.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Inconsistent scene contract' });
  }
});
export const SessionSchema = z.object({
  id: z.string().uuid(), persona: PersonaSchema, revision: z.number().int().min(0).max(4), scene: SceneSchema,
  inventory: z.array(z.string().min(1)).max(3), journal: z.array(z.string().min(1)).max(4), story_mode: z.literal('deterministic-demo'), voice_mode: z.enum(['mock', 'live', 'unavailable']),
}).strict().superRefine((session, ctx) => {
  if (session.revision !== session.scene.chapter - 1 || session.journal.length !== session.revision
    || session.inventory.length !== Math.min(3, session.revision) || new Set(session.inventory).size !== session.inventory.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Inconsistent story memory' });
  }
});
export type Session = z.infer<typeof SessionSchema>;
export const AuthSchema = z.object({ access_token: z.string().min(1), token_type: z.literal('bearer'), expires_in: z.number() });
export const CapabilitiesSchema = z.object({
  story: z.literal('deterministic-demo'), voice: z.enum(['mock', 'live', 'unavailable']),
  assemblyai_available: z.boolean(), live_ttfa_ms: z.null(), reason: z.string(),
});
