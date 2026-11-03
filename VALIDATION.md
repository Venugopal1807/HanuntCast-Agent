# Release preparation — 2026-10-30

Repository reality was inspected: main remains at `fc2a81f`, the initial README commit. The application and release changes are still largely untracked and no release files are staged. No commit, push, hosting change, deployment, external API test, registry query or paid synthesis was performed. Prior short HTTP/WS successes remain historical evidence in DEVELOPMENT.md.

| Executed check | Final result |
| --- | --- |
| `.venv/Scripts/python.exe -m pytest backend/tests -q --tb=short --disable-warnings` | **427 passed, 1 paid smoke skipped**, 20.03 seconds; existing dependency warning |
| `.venv/Scripts/python.exe -m ruff check backend tools` | Passed |
| `npm.cmd test` (frontend) | **63 passed** across 10 files, 12.59 seconds |
| `npm.cmd run lint` | Passed |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run test:e2e` | Production build passed; **16 desktop/mobile tests passed**, 59.0 seconds |
| `node scripts/streaming-smoke.mjs` (no live flag) | Free rehearsal passed with restricted proxy-header emulation and a fresh simulated ledger |
| `.venv/Scripts/python.exe -m pip check` | No broken requirements |
| `.venv/Scripts/python.exe tools/release_audit.py` | Passed on eligible source, tracked files and built assets; no secret values printed |
| `.venv/Scripts/python.exe tools/release_audit.py --staged` | Passed; nothing staged |

Checks used process-local `VOICE_PROVIDER=mock`, `DEPLOYMENT_MODE=local`, a fixture credential and both paid flags set to 0. The fixture configuration did not overwrite .env. Existing historical paid-attempt markers remain untouched. The release audit confirmed ignored .env/.env.production, SESSION_REPORT.md, private state, raw audio and browser artifacts. Actual configured secret values were compared internally against source/build content without printing them. A literal credential/private-key/JWT detector and optional staged hook are additional checks; they do not make forced commits or hook bypass impossible. The initial audit exposed an empty-env parser consuming a following comment; horizontal-whitespace parsing and a regression fixed that false positive.

New backend evidence includes atomic concurrent reservations (only three of twelve contenders succeed with a three-attempt allowance), persisted totals, app recreation without budget reset, exclusive ledger initialization, missing/corrupt/locked/exhausted/character-budget denial before HTTP or WS connection, retained reservation after upstream failure, missing/wrong access-token denial despite a valid anonymous JWT, public mock fallback even with a provider key present, public live configuration rejection, strong production JWT checks, sensitive path/content detection and private env generation that neither overwrites nor prints secrets. Frontend regressions verify 403/503 paid-route denials surface without retries. Existing story, personalized endings, ownership, stale streams, cooldown, controls, AudioContext deadlines and replay-cache tests remain active.

The free rehearsal used one simulated synthesis, 12 chunks / 57,600 PCM bytes at 24 kHz. Browser/backend hashes matched. Output/scheduling preceded completion; pause held time, muted output advanced at zero gain, cached replay created no extra request, and cancel/scene changes closed contexts. The harness binds only loopback and supplies its private fixture header internally; production main.py has no such injection. Its fixture ledger is separate from any live accounting. Reports remain under ignored test-results/assemblyai-stream-smoke/rehearsal. No live ledger allowance was initialized by this task.

Installed Python versions were captured in backend/requirements.lock.txt; frontend already has package-lock.json. Production assets remain 49 modules, JS 325.40 kB / 97.67 kB gzip and CSS 25.63 kB / 6.89 kB gzip. No dependency was installed/updated and no online vulnerability audit ran. Exact version pins are a tested local snapshot, not a claim of target-Linux installation or absence of vulnerabilities.

Public-demo assessment: publish only DEPLOYMENT_MODE=public with VOICE_PROVIDER=mock and no provider credential. Live requires an operator-restricted network/proxy, independent secret header and existing durable SQLite allowance. Paid transport atomically reserves cumulative attempts and input characters before connecting and fails closed on denial. Failures/cancellation receive no refund. No public budget/admin/reset control exists. This caps application input volume/attempts, not provider-account spending by other clients or a guaranteed dollar amount. Protected persistent storage is a deployment gate; if it cannot be guaranteed, use public mock plus a restricted local live recording.

Prepared documents: RELEASE_CHECKLIST.md, RELEASE_COMMANDS.md, DEPLOYMENT.md, SUBMISSION.md, DEMO_SCRIPT.md, HANDOFF.md and PROJECT_CONTEXT.md. deploy/ contains public/restricted env samples, nginx templates and the single-worker systemd service. tools/ contains offline release auditing, optional staged hook and exclusive private-env generation. No populated deployment credential file or real allowance was created. Existing source/docs were updated for the new gates without UI redesign.

Readiness: ready for operator review and target-host staging, **not yet deployed or submitted**. Outstanding gates: choose host/domain/TLS; install/validate pinned dependencies on the target OS; test nginx/systemd and same-origin HTTPS/streaming there; review and manually publish the full source; confirm durable storage if enabling restricted live; separately authorize/record actual voice; review physical-device/assistive-technology behavior; fill and publish the demo/video/release links. Existing Starlette/httpx and Playwright environment warnings remain. No paid performance or current account-access claim is made.

# Final focused visual refinement — 2026-10-30

The previous baseline was verified before editing: backend 400 passed / 1 paid smoke skipped; frontend 60 passed. This phase adds original SVG atmosphere and presentation refinements only. No backend, story/narration, Web Audio engine, provider protocol, replay cache or request semantics changed. No paid synthesis, external API call, commit, push or deployment occurred. Git HEAD remains `fc2a81f`.

| Check | Verified result |
| --- | --- |
| Backend pytest (`.venv/Scripts/python.exe -m pytest backend/tests -q --tb=short --disable-warnings`) | 400 passed, 1 paid smoke skipped; 7.35 seconds; existing dependency warning |
| Frontend Vitest (`npm.cmd test`) | 61 passed across 10 files; 16.90 seconds |
| Ruff (`.venv/Scripts/python.exe -m ruff check backend`) | Passed |
| ESLint (`npm.cmd run lint`) | Passed, including the new offline contact-sheet helper |
| TypeScript (`npm.cmd run typecheck`) | Passed |
| Production build (via `npm.cmd run test:e2e`) | Passed; 49 modules; JS 325.40 kB / 97.67 kB gzip; CSS 25.63 kB / 6.89 kB gzip |
| Playwright desktop/mobile (`npm.cmd run test:e2e`) | 16 passed in the final run; 51.3 seconds |
| Free streaming (`node scripts/streaming-smoke.mjs`, no live flag) | Passed in isolation; one simulated request; 12 chunks / 57,600 bytes / 24 kHz |
| Offline contact sheets (`node scripts/visual-contact-sheets.mjs`) | Six generated and visually inspected |

All local checks used mock settings, a fixture credential and disabled paid-smoke flags. The rehearsal's substituted upstream socket reported `websocket_connected=false`; browser/backend PCM hashes matched. Incremental scheduling, completed replay without another request, frozen pause timeline, continuing zero-gain muted timeline, cancel and scene-change context cleanup passed. The successful rehearsal reports are in ignored `test-results/assemblyai-stream-smoke/rehearsal/`.

Visual work completed:

- Threshold: house entrance, dark trees, central doorway and moonlight. Gallery: framed portrait, cracked gothic mirror and spectral reflection. Belfry: bell, ribbon, tower beams and moonlight. Reckoning: spectral doorway, fractured light and ritual floor geometry.
- Liberation uses dawn warmth and an open illuminated door. Escape uses cold moonlight and obscuring branches. Inheritance uses violet shadows, lit windows and a keeper's seal. All remain recognizably the same house. The turning-point panel highlights the actual belfry journal entry; complete personalized narration and the full decision path are preserved.
- The primary player action is visually dominant; Replay, Mute and Cancel are subdued. Initial wait feedback is immediate and uses no fake progress. The waveform is visibly labeled decorative, remains hidden from assistive technology, and stops animating under reduced motion. Loading/cancel, paused/muted/stopped/error and completed-cache behaviors retain regression coverage.
- Mobile title sizing, hero whitespace, narrator-card height, scene banners, button focus and ending hierarchy were refined. Visual inspection removed the selection CTA's earlier sticky overlap. Playback remains sticky except in short viewports, as before.

Screenshot inventory: **90 individual PNG captures plus six contact sheets** under ignored `frontend/test-results/`. Landing, narrator selection, active story and all three endings are captured at **320, 375, 390, 768, 1024 and 1440px**. The canonical desktop/mobile liberation-flow folders also contain the four main screens and Gallery/Belfry/Reckoning captures; ending folders contain each ending at all six widths. Contact sheets are `visual-review/{landing,narrators,story,ending-liberation,ending-escape,ending-inheritance}.png`. These actual PNGs were inspected, including the final unobscured mobile narrator layout and Reckoning scene. All six widths passed horizontal-overflow assertions. Full-page capture scroll is normalized so sticky controls do not paint over the ending hero in exported images.

Corrections during validation: the first UI run found a duplicate status-role selector after adding immediate wait guidance; the supplemental message now uses a polite live announcement while playback retains its primary status region. The new artwork regression verifies seven distinct compositions and isolated SVG gradient IDs. An early responsive capture loop repeatedly authenticated and reached the local rate limit; it now reuses one mounted page. Initial overlapping/stalled free rehearsals were stopped, their validation processes checked, and a fresh isolated simulated run passed. Backend limits were retained.

Modified files: `frontend/src/SceneArt.tsx` (new), `App.tsx`, `AudioPlayer.tsx`, `styles.css`, `frontend/src/test/SceneArt.test.tsx` (new), `frontend/e2e/experience.spec.ts`, `frontend/scripts/visual-contact-sheets.mjs` (new), README.md, DEVELOPMENT.md and VALIDATION.md.

Visual refinement is complete for the requested scope. No functional or layout blocker remains in the checked browser sizes. Native keyboard controls, focus indicators, collapsed transcripts and reduced motion remain intact; controls keep at least 44px targets. Physical-device audio quality, real screen-reader evaluation and broader browser/device coverage remain outside this evidence. Full-story paid-provider behavior was not retested. Existing Starlette/httpx and Playwright color-environment warnings remain. Earlier entries below are historical.

# Blackthorn House UI/UX redesign — 2026-10-30

Implemented on the validated story/audio baseline. This phase changes presentation and adds a read-only landing capabilities check through existing authenticated routes. No backend source, story choices, narrator prose, provider transport, audio lifecycle, PCM queue or cache semantics changed. No paid synthesis, external API tests, microphone, LLM story generation, commits, pushes or deployment occurred. All test commands forced mock mode and a fixture credential, with both live smoke flags set to `0`; the root `.env` and historical paid-attempt markers were preserved.

| Executed command | Final result |
| --- | --- |
| `.venv/Scripts/python.exe -m pytest backend/tests -q --tb=short --disable-warnings` | 400 passed, 1 paid HTTP smoke skipped; 4.54 seconds; existing dependency warning |
| `.venv/Scripts/python.exe -m ruff check backend` | Passed |
| `npm.cmd test` in frontend | 60 passed across 9 files; 8.82 seconds |
| `npm.cmd run lint` in frontend | Passed |
| `npm.cmd run typecheck` in frontend | Passed |
| `npm.cmd run test:e2e` in frontend | Production build passed; 14 desktop/mobile Playwright tests passed in 23.3 seconds |
| `node scripts/streaming-smoke.mjs` in frontend (no `--live`) | Free simulated-provider rehearsal passed; one stream; no AssemblyAI connection |

The production build transformed 48 modules. JavaScript: 319.17 kB / 95.51 kB gzip; CSS: 21.70 kB / 6.08 kB gzip. Existing cross-language tests still validate all 945 actual Python scene snapshots across the 189 persona/routes. Existing failure, cancellation, timeout, cooldown and cache regressions remain active.

Completed screens and hierarchy:

- Landing: BLACKTHORN HOUSE title, voice-storytelling subtitle, server-reported capability badge, primary Start the experience action, compact features and atmospheric local SVG treatment. Old “hears you” copy was removed from the rendered UI and document title.
- Narrator selection: three distinct cards, personality summaries, sample quotes, George/Jane/Audrey voice badges, native radio selection and bottom Enter action (sticky on mobile).
- Story: chapter header, persistent narrator/player panel, compact scene atmosphere, large choices, collapsed transcript, then collapsed discoveries/journal. Safe metrics and local voice settings are behind a diagnostics disclosure. Loading for five seconds shows a clean connection-delay message without blocking Cancel or choices.
- Ending: ending hero, personalized narration in an expandable ending transcript, visible remembered-decision path, Replay ending and new-path action. No automatic playback or paid retries were added.

New regression coverage checks configured/failed capability badges without narration, bootstrap-token reuse, late status authentication preserving story ownership, collapsed panels resetting on scene change, delayed connection feedback and cancellation. Browser tests explicitly expand ending transcripts before asserting personalized prose. Two added desktop/mobile cases verify the listening hierarchy, collapsed panels, persistent player visibility and no horizontal overflow at 320, 375, 768 and 1440 pixels. Existing browser flows still cover all endings, mock WAV playback controls, lost-response UUID reuse, keyboard/reduced-motion entry and pending-navigation cancellation.

The final free rehearsal delivered 12 synthetic PCM chunks / 57,600 bytes at 24 kHz through the real app, route and adapter with a substituted upstream socket. Browser/backend hashes matched. Scheduling and browser output preceded stream completion. Pause held the timeline; muted playback advanced with zero gain; unmute restored gain. Cached replay, Cancel and scene change used one local streaming HTTP request and closed their AudioContexts. Reports remain in ignored `test-results/assemblyai-stream-smoke/rehearsal/{backend,browser}.json`. Synthetic timings are not live-service measurements.

Desktop and 375px mobile landing, narrator, story and liberation-ending screenshots were visually inspected. Captures are regenerated under `frontend/test-results/experience-complete-real-API-route-to-liberation-{desktop,mobile}/`; escape/inheritance captures remain in their corresponding folders. Typography, player hierarchy, collapsed sections, edge-to-edge actions and ending summaries were checked. The interface uses local system/Georgia fonts, Midnight Indigo actions, 1px gray borders, 4px panel corners, no drop shadows and reduced-motion support.

Files changed in this phase:

- UI: `frontend/src/App.tsx`, `AudioPlayer.tsx`, `styles.css`, new `narrators.ts`, and `frontend/index.html`.
- UI integration: `frontend/src/api.ts` (capabilities method and first-set-wins auth assignment; existing backend routes retained).
- Regression/evidence: `frontend/src/test/{App,api,live-audio}.test.*`, `frontend/e2e/experience.spec.ts`, and `frontend/scripts/streaming-smoke.mjs`.
- Documentation: README.md, DEVELOPMENT.md, DEMO_GUIDE.md and VALIDATION.md.

Ready for final visual refinement against later design references. UX tradeoffs: transcripts and detailed remembered history require disclosure; the player uses normal flow at viewport heights of 600px or less; the landing badge reports configuration at mount and session mode thereafter rather than continuously probing the service. Live voice labels represent the existing default mappings. Native details/radios preserve keyboard operation; real assistive-technology and physical-device testing are still separate from this browser evidence. Existing Starlette/httpx deprecation and Playwright color-environment warnings remain. No new live full-story or acoustic-quality verification was performed.

# Independent Astra review corrections — 2026-10-29

All seven findings were confirmed before correction. Reproduction tests ran against the original implementation: backend 14 failed / 3 passed (name disclosure and missing/invalid cooldown metadata); focused frontend 7 failed / 11 passed (early Replay, inaccurate mute status, discarded cooldown, long pause and three unresolved/canceled AudioContext cases). Landing copy and DEMO_GUIDE.md's obsolete integration claims were confirmed by source inspection. These expected failures were followed by the final passing runs below.

| Executed command | Final result |
| --- | --- |
| `.venv/Scripts/python.exe -m pytest backend/tests -q --tb=short --disable-warnings` | 400 passed, 1 paid HTTP smoke skipped; 1 existing dependency warning; 5.41 seconds |
| `.venv/Scripts/python.exe -m ruff check backend` | Passed |
| `npm.cmd test` (frontend) | 54 passed across 9 files; 5.71 seconds |
| `npm.cmd run lint` (frontend) | Passed |
| `npm.cmd run typecheck` (frontend) | Passed |
| `npm.cmd run test:e2e` (frontend) | Production build passed; 12 desktop/mobile Playwright tests passed in 46.7 seconds |
| `node scripts/streaming-smoke.mjs` (frontend, no `--live`) | Free rehearsal passed; simulated provider only; no AssemblyAI connection |

The final build transformed 47 modules; JavaScript was 316.99 kB / 95.04 kB gzip. Existing cross-language validation still parses all 945 Python scene snapshots across all 189 persona/routes. No visual styling or layout was changed.

Focused regressions cover undiscovered-name inventory for all three personas, portrait discovery and liberation introduction continuity, a four-minute intentional pause, continued delivery beyond the old 15-second lookahead while paused, expiration of genuinely stalled unpaused playback, never-resolving suspend/resume, immediate abort cleanup, incomplete/loading Replay gating, completed cached replay, cooldown expiry without automatic synthesis, malformed cooldown rejection, provider failure metadata through the authenticated stream route, and stale scene-frame cancellation. Existing exhaustive story, ownership, idempotency and provider failure tests were retained.

The free rehearsal used the actual app, authenticated backend route, provider adapter and headless Edge Web Audio with a substituted socket. It delivered 12 chunks / 57,600 bytes of synthetic PCM at 24 kHz. Browser and backend SHA-256 hashes matched. Scheduling and output presentation preceded completion. Pause held the context timeline; muted playback advanced with zero gain; unmute restored gain. Cached replay, Cancel and scene changes used just one local streaming request and closed the contexts. Evidence is in ignored `test-results/assemblyai-stream-smoke/rehearsal/{backend,browser}.json`. These timings describe simulated audio, not live service performance.

Checks forced mock mode and a fixture credential in the process environment with `HAUNTCAST_LIVE_SMOKE=0` and `HAUNTCAST_LIVE_STREAM_SMOKE=0`. The rehearsal switches only its isolated backend to the simulated live adapter. The real `.env` and existing live-attempt markers were preserved. No paid synthesis, external API testing, credential output, deployment, commit or push occurred.

The app is ready for the UI/UX redesign from this regression baseline. Full-story live narration, physical-speaker quality, all configured live voices and cancellation during active real synthesis remain outside this phase's verification. Existing Starlette/httpx deprecation and Playwright color-environment warnings remain. Playback may now schedule up to 180 seconds rather than 15 seconds ahead so delivery can complete during a pause; byte/duration limits and cancellation cleanup remain enforced. Earlier evidence below is historical and does not supersede these results.

# Character narration and personalized endings — 2026-10-29

This phase ran no paid synthesis, LLM API, deployment, commit or push. Checks used process-local mock settings and a dummy key, with both live smoke flags removed; the real `.env` and existing live-attempt guards were preserved.

| Executed command | Result |
| --- | --- |
| `.venv/Scripts/python.exe -m pytest backend/tests -q --tb=short --disable-warnings` | 383 passed, 1 paid HTTP smoke skipped; 1 existing dependency warning |
| `.venv/Scripts/python.exe -m ruff check backend` | Passed |
| `npm.cmd test` | 43 passed across 8 files |
| `npm.cmd run lint` | Passed |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run test:e2e` | Production build passed; all 12 desktop/mobile Playwright tests passed in 48.1 seconds |

The build transformed 47 modules; JavaScript was 315.10 kB / 94.59 kB gzip. All 945 actual Python response snapshots passed browser Zod validation, covering the unchanged 189 complete persona/path combinations. Independent enumeration found 393-760 characters per narration, below the 1,500-character voice limit. Each narrator produces 9 Liberation, 27 Escape and 27 Inheritance variants (189 epilogues total); summary evidence is in ignored `test-results/narrative-validation.json`.

New tests compare all three perspectives at every chapter while requiring identical scene metadata, options, inventory, facts and canonical outcomes. They check promise continuity, name/key/passage recall, discovered versus opened exits, Eleanor's freedom, deterministic read-only rendering, memory consistency and personalized session isolation. Mocked WebSocket integration tests cover all seven scenes for all three voice mappings and assert Generate contains the exact displayed text. Frontend tests cover every narrator/ending replay cache and clearing cached audio on scene change. Existing cancellation, failure, pause/resume/mute and ownership tests remain intact. Playwright now also asserts actual persona/decision-specific ending prose through the compiled app and real local mock backend.

No regressions were detected. The existing Starlette/httpx deprecation warning and Playwright color-environment warning remain. Actual acoustic quality of the new narration, full-scene live latency and active-provider cancellation were not retested; no physical-speaker audibility claim is made. The earlier authorized short live transport results are recorded in DEVELOPMENT.md. Older evidence below describes the project's state at its original date.

# MVP verification — 2026-10-20

The existing implementation was inspected before edits. The story provider and disabled AssemblyAI adapter were preserved. All files remain uncommitted and unpushed.

| Executed command | Result |
| --- | --- |
| `npm.cmd run lint` (frontend) | Passed |
| `npm.cmd run typecheck` (frontend) | Passed |
| `npm.cmd test` (frontend) | 25 tests passed across 6 files |
| `npm.cmd run build` (invoked by test:e2e) | Passed; 46 modules; JS 306.79 kB / gzip 91.97 kB |
| `npm.cmd run test:e2e` (frontend) | 12 passed in 42.4 seconds; desktop + 375px mobile emulation |
| `..\.venv\Scripts\python.exe -m pytest -q` (backend) | 212 passed; one existing dependency warning |
| `.\.venv\Scripts\ruff.exe check backend` (root) | Passed |
| `git status --short --untracked-files=all` | Project files remain untracked; generated output ignored |

The frontend suite includes a cross-language check: 945 actual Python-generated scene response models, covering all scenes from 189 complete persona/path combinations, are parsed with the browser Zod contract. Backend tests include complete HTTP routes to every ending, terminal-state rejection, memory isolation within/across anonymous owners, and sanitized correlated failures.

Browser checks use the compiled product, a real local FastAPI backend and installed headless Edge. They cover every ending with three personas at desktop/mobile sizes, mock labels, inventory/journal continuity, decoded mock-WAV playback, pause/resume/mute/replay/Cancel, Listen/Return shortcuts, scene interruption, a committed decision whose first response is dropped, keyboard focus, reduced motion and leaving during a pending request. No page errors were observed in the ending flows. Screenshots were generated and desktop ending/mobile story captures were visually inspected.

Failures found and resolved during this review:

- The expanded audio mock initially omitted the newly imported ApiError class; the test now partially mocks the API module and the suite has no unhandled rejections.
- Sandboxed Node could not launch Python for the cross-language test; that check passed with authorized runtime access. It was not skipped or replaced with hardcoded data.
- One initial mobile full-page screenshot hit an Edge capture protocol error. Waiting for compositor frames and disabling capture animations fixed it. Both subsequent complete browser runs passed. Transition opacity and an unfocused skip-link artifact were also resolved for captures.

The remaining Starlette/httpx TestClient deprecation warning is from installed dependencies. Playwright emits a harmless FORCE_COLOR/NO_COLOR environment warning. Neither was suppressed.

Physical-device sound quality and OS-specific speech delivery are not established by browser emulation. Device speech cancellation also has mocked regression coverage. Live AssemblyAI audio, WebSocket framing and latency remain unimplemented and unverified. The adapter fails closed, including when a placeholder credential is supplied.

## Initial scaffold evidence

Project files created and Git initialized in `D:\dev1\hauntcast-ai`. No commits or pushes performed.

| Check | Observed result |
| --- | --- |
| Frontend dependencies | Installed; package-lock.json generated |
| Backend dependencies | Installed in project .venv |
| `npm test` | 10 tests passed across 3 files |
| `npm run lint` | Passed |
| `npm run build` | TypeScript and Vite build passed; 44 modules transformed |
| `python -m pytest -q` | 207 tests passed; one dependency deprecation warning |
| `ruff check backend` | Passed |
| Git status | All project changes untracked; generated dependencies and build output ignored |
| Real-browser visual/device-speech review | Not performed |
| Live AssemblyAI TTS | Disabled; not implemented or tested |

The initial frontend test run had three selector failures: a substring query for Play also matched Replay. Exact accessible-name queries fixed this, and the complete frontend suite then passed.

Backend coverage includes 189 complete persona/path combinations, conditional ending eligibility, inventory continuity, invalid transitions, anonymous JWT ownership, expired/tampered tokens, UUID idempotency, stale revisions, concurrent decisions, expired sessions, rate limits, decodable mock WAV output and disabled AssemblyAI mode even with a placeholder key.

Frontend coverage includes all ending presentations, restart, Zod rejection of invalid input/live claims, identical UUID reuse after connection failure, stale story response suppression, audio request cancellation, stale audio rejection, play/pause/resume/mute/replay, object URL cleanup and retryable audio errors. Browser media elements are mocked in these tests; real device speech and autoplay behavior still require browser QA.

Environment: Node.js 24.18.0, npm 11.16.0, Python 3.14 environment. The installed Starlette version warns that its httpx-based TestClient path is deprecated in favor of httpx2; tests still pass. npm reported deprecation notices for whatwg-encoding and ESLint 9. These notices were not suppressed.

Initial sandbox registry/runtime access failures were resolved using the execution permission mechanism. No API credentials were used. No live performance measurement or production-readiness claim is made.
