# HauntCast AI — BLACKTHORN HOUSE

**Every ending has a voice. A haunted story that remembers your choices.**

## Problem and solution

Interactive fiction often asks the audience to read long passages before making a choice. HauntCast makes the narrator and listening controls the center of the experience. Enter Blackthorn House, choose the Archivist, Skeptic or Medium, and make four consequential decisions. Each narrator gives the same canonical world a distinct perspective. Inventory, discoveries and promises carry forward into one of three personalized endings: Liberation, Escape or Inheritance.

## AssemblyAI integration

The backend integrates AssemblyAI-TTS-1 using the documented HTTP speech endpoint and incremental WebSocket transport. The app's live path uses Begin configuration, Generate, Flush, raw PCM audio and completion/termination frames. Browser Web Audio schedules decoded little-endian PCM incrementally at the provider's echoed sample rate. The exact displayed scene prose is narrated in the selected mapped voice (George/Jane/Audrey). Completed scene audio is cached locally for replay; early live Replay is blocked so it cannot silently start another synthesis. Pause stops playback time; mute silences output while time continues. Cancel and scene changes close active transport/playback resources.

Earlier separately authorized short HTTP and WebSocket tests are recorded in DEVELOPMENT.md. Those records are historical evidence, not a claim that every full scene, voice or deployment has been tested live. This release phase made no paid requests. The public demo is intended to use free mock audio; live narration is restricted to an approved operator demonstration with cumulative reservations. No mock playback is presented as AssemblyAI speech.

## Technologies

React 19, TypeScript, Vite, Tailwind/CSS, Zod, original local SVG artwork, Web Audio, Python/FastAPI, Pydantic, PyJWT, httpx, WebSockets and SQLite for the private cumulative synthesis ledger. Stories/sessions remain deterministic and process-local. Tests use pytest, Ruff, Vitest, ESLint, TypeScript and Playwright.

## Differentiators

- Three narrator perspectives with deterministic personalized epilogues across 189 persona/routes.
- Listening-first responsive layout, original scene artwork and distinct dawn/moonlight/violet endings.
- Remembered decisions with complete optional transcripts; no microphone or speech recognition.
- Incremental PCM delivery, explicit playback controls, cache-only completed replay and no automatic paid retries.
- Public mock fallback, restricted live access, fail-closed cumulative attempt/character budget and server-only credentials.

## Testing evidence

Final local release checks: **427 backend tests passed, one paid smoke skipped; 63 frontend tests passed; 16 desktop/mobile browser tests passed.** Ruff, ESLint, TypeScript, production build, installed dependency consistency and the offline release audit passed. Release regressions include budget concurrency/persistence, access/budget denial and secret redaction. The free streaming rehearsal passed using a simulated upstream with the actual browser player and authenticated backend route. It proves local scheduling/control behavior, not provider speed or physical-speaker quality. See VALIDATION.md for commands and limits. No performance percentage, award, eligibility or benchmark claim is made.

## Known limitations

Deterministic story, one scenario, four decisions, three canonical endings. Anonymous sessions expire and are lost on backend restart; one worker per instance. No microphone, STT, LLM story generation, accounts or durable story saves. Full-story live voice quality, real assistive-technology evaluation and target-host deployment still require separate checks. Budget accounting depends on protected durable storage and applies to this application's calls, not other use of the provider account. Public hosting is mock-only; live recording requires explicit authorization. Hackathon eligibility/rules have not been independently checked in this offline task.

## Submission links — fill before submitting

- GitHub repository: `<GITHUB_REPOSITORY_URL>` (configured repository: `https://github.com/Venugopal1807/HanuntCast-Agent`; application release not yet pushed)
- Public hosted demo: `<PUBLIC_MOCK_DEMO_URL>`
- Demo video: `<DEMO_VIDEO_URL>`
- Release commit: `<VERIFIED_RELEASE_COMMIT>`

Owner/contributor attribution must reflect the repository owner's approved submission details.
