# Development

## Release preparation

The production strategy is a public mock instance and an optional separate restricted live instance. main.py now enforces production JWT requirements, rejects a public AssemblyAI configuration and requires a private reverse-proxy header for streaming. budget.py uses an existing SQLite ledger with atomic cumulative attempt/character reservations before both provider transports; no refund/reset web endpoint exists. Failed/canceled attempts retain reservations. Local/mock story behavior and frontend design are retained. See DEPLOYMENT.md for durable-state assumptions, single-worker constraints, proxy configuration, health and rollback; VALIDATION.md records the release checks. The validation harness injects only a fixture token inside its isolated loopback backend and initializes only fresh simulated ledgers. No live production allowance was created.

## Final visual refinement

`SceneArt.tsx` is original SVG artwork with seven treatments: Threshold entrance, Gallery portrait/mirror, Belfry bell/ribbon/moonbeam, Reckoning spectral doorway, and Liberation/Escape/Inheritance variations of the same house. React useId isolates gradient definitions. The artwork is decorative in the scene layout and never adds story facts or reveals the child's name. No image libraries, remote assets or runtime dependencies were added.

Ending color accents and house details distinguish warm dawn release, cold unresolved escape and violet keeper permanence. The turning-point panel displays the server's third journal entry (the belfry choice), followed by the outcome and full remembered path. No story/narration or Web Audio source was edited. The player adds immediate first-audio wait guidance, keeps the existing delayed connection feedback, and labels the waveform as decorative rather than a meter. Its primary action is wider; secondary controls retain keyboard focus indicators and comfortable tap heights.

Mobile refinements reduce the landing's empty space and narrator card height, fit the title at 320px, provide landscape scene banners, and keep complete transcripts collapsed. The narrator-selection CTA now uses normal flow: visual inspection found the earlier sticky CTA obscured cards in long pages. The playback dock remains sticky, with the existing short-height exception. Reduced-motion rules cover both waveform and the restrained scene arrival transition.

Browser validation captures landing, selection, story, scene variants and all endings at desktop/mobile sizes, plus six-width reviews (320/375/390/768/1024/1440). Capture scroll is normalized to avoid full-page screenshots painting sticky controls over ending titles. Responsive landing checks reuse the mounted app rather than creating six anonymous identities. `node scripts/visual-contact-sheets.mjs` produces offline contact sheets from those screenshots using the existing browser dependency; it opens no app or provider connection. See the latest VALIDATION.md entry for verified results and known limits.

## Blackthorn House listening-first UI - 2026-10-30

The presentation layer now leads with narrator identity, audio state, atmosphere and decisions. Landing uses the existing mansion SVG with local gradients/mist and system/Georgia typography; no images, fonts or scripts are fetched from external services. Midnight Indigo actions, gray 1px borders, 4px corners and restrained waveform motion replace the earlier reading/sidebar layout. No drop shadows are used. Reduced-motion preferences disable waveform animation.

`narrators.ts` supplies shared card/player identity and default live voice labels. `AudioPlayer` still uses the unchanged `useAudio` lifecycle and cache. It presents Connecting, Playing, Paused, Muted, Replay ready and Stopped states, with a five-second loading-delay message and Cancel available throughout loading. Provider metrics and optional local voice settings sit behind a native details disclosure. Live credit/cached-replay disclosure remains visible. Every primary playback action is at the panel's bottom edge; links and secondary disclosures have at least 44px tap height. The whole compact panel sticks near the viewport top except on screens 600px tall or shorter, where it returns to normal flow. Expanded diagnostics have a bounded scrolling body.

The transcript and journal use native details elements, default closed on both form factors. They remount by scene revision, so an expanded previous chapter does not reveal the next transcript. Ending cards retain exact server prose in an ending transcript, a visible decision-path summary, Replay ending and Enter again. The mobile narrator-selection CTA sticks to the bottom while scrolling the cards. Focus moves to the new scene heading without scrolling past the player; existing cancellation on navigation/choice remains intact.

Landing capabilities use the existing authenticated route, with no new backend endpoints or public exceptions. The same anonymous bootstrap token is reused by Start to avoid unnecessary authentication requests. First-set-wins token assignment prevents a delayed landing-auth response from replacing the identity that already owns an active story. Cancellation and timeouts use the existing request wrapper. The badge is configuration status, not a new live health probe; failed checks show status unavailable. It is checked on mount, with the session's authoritative mode taking over once a story starts.

No backend, story graph, narration, provider protocol, voice mapping, audio scheduling or replay logic changed in this redesign. Existing exhaustive regressions remain in place. New focused checks cover collapsed/reset disclosures, mode badges without narration requests, capabilities auth reuse/races, delayed connection feedback/cancel, and persistent controls with no horizontal overflow from 320px through 1440px. Browser ending checks open the transcript explicitly before asserting personalized prose. The free streaming rehearsal opens diagnostics only to read the safe timing evidence; it retains the one-request constraint and simulated provider. See VALIDATION.md for final results and screenshot review.

## Independent review corrections - 2026-10-29

All seven findings were confirmed against the existing source. Before implementation, focused tests failed on premature inventory disclosure (six persona/route cases), absent provider metadata (including NaN/Infinity conversion failures), early Replay availability, inaccurate mute status, a four-minute pause, and suspend/resume promises that never settle. The landing and demo guide also contained obsolete mock-only/protocol-pending claims.

The promise item now says “A promise to the girl”; the existing portrait discovery and ending prose remain unchanged. This preserves canonical memory validation and all 189 persona/routes. Live mute remains zero gain with a running timeline, now accurately described in status and accessible help. Pause suspends the context and credits elapsed pause time back to the playback deadline. Network consumption no longer waits on 15-second scheduling backpressure: incremental buffers may be scheduled up to the existing 180-second total audio limit, bounded alongside the 8,640,000-byte stream/cache limit. This allows transport delivery to finish while paused without extending network/provider deadlines. It can retain more scheduled browser audio than the old 15-second lookahead, but remains bounded.

Suspend/resume share a guarded operation, settle within 10 seconds or on abort, and close resources on failure. Late settlements cannot restart canceled audio. Cleanup remains idempotent; context close is fire-and-forget and cannot block cancellation. Live Replay has both a UI gate and hook guard requiring a completed scene cache. Incomplete failures direct users to an explicit new paid Play attempt; no automatic retries exist. A generation check prevents an old transport completion from repopulating a new scene cache.

Provider errors carry `retryable` and `retry_after_seconds` through VoiceUnavailable, NDJSON and ApiError. Only a literal provider boolean true is retryable. Finite numeric cooldowns are rounded up and clamped to 0–300; booleans, strings and nonfinite values become zero. The browser Zod contract accepts only a boolean and an integer cooldown in that range (absent metadata defaults conservatively to false/zero). Existing HTTP Retry-After handling remains intact.

No CSS, layout, story graph, voice mapping, credentials, deployment or Git history changed. Verification in this phase uses mock transports and the free real-browser streaming rehearsal only; the earlier short live transport evidence remains historical. Full-scene live behavior and physical speaker quality are outside this phase's evidence.

## Architecture

```text
React views + Zod request/response contracts
    │ same-origin /api + bearer JWT + AbortSignal
FastAPI routes + Pydantic + request limits
    │ ownership + revision + UUID receipt + atomic transition
Expiring memory: persona / scene / facts / inventory / journal
    ├── StoryProvider → DemoStoryProvider
    └── VoiceProvider → MockVoiceProvider
                       AssemblyAIVoiceProvider (opt-in live stream)
```

`backend/app/story.py` owns the narrative graph, choice effects and memory validation. `backend/app/narration.py` owns original persona prose and deterministic ending templates. `StoryProvider` is a provider-agnostic boundary for a future LLM. Such an adapter must consume canonical memory, return a validated scene and preserve valid choices; it must never invent inventory or alter ending eligibility.

`backend/app/main.py` owns JWT authentication, expiry, limits and session access. A locked copy/validate/commit operation prevents concurrent choices from advancing the same revision twice. Exact UUID retries return the original receipt; conflicting reuse is rejected. Start requests are idempotent within the anonymous identity. Fixed HS256 algorithm, issuer, audience and expiry checks protect tokens. A process-random signing key is used unless a sufficiently long environment value is supplied. Tokens stay in browser memory.

`frontend/src/api.ts` centralizes requests and Zod parsing with a 15-second timeout covering both headers and response consumption. The view retains UUIDs on retries and locks choices until recovery. AbortControllers and generation counters discard late responses after navigation. Audio unmounts when a transition starts; cleanup aborts the request, stops playback, cancels device speech and revokes its object URL. Audio requests include the scene revision. No provider calls occur on rerender.

The mock adapter produces an original six-second PCM16 mono WAV at 16 kHz. It does not synthesize speech. Optional browser speech uses English voices the device reports as local. Muting holds speech and silences ambience; unmuting resumes speech when playback is active. Replay restarts both. Cancel aborts loading, bounded play/resume promises and local speech, revokes the URL and resets status. The waveform is decorative. Play/decode waits are bounded at 10 seconds. Speech has a five-second start watchdog and a word-count-based completion deadline capped at three minutes; paused/muted time does not consume it. Real device speech support must be checked in the target browser.

`ErrorBoundary.tsx` catches render failures and remounts the experience on recovery. Async API/audio failures are handled at their operation boundaries. `diagnostics.ts` accepts only allowlisted primitive metadata and validated request IDs. Global error listeners log categories, never raw exception objects. Backend middleware sanitizes unexpected failures and emits a server-generated correlation ID, route name and status, without request bodies or credentials.

Both Python and Zod enforce chapter/scene/end-state consistency, journal/revision agreement, inventory length and unique choice IDs. The client also checks session identity and expected revision after decisions. Request cancellation is checked after body consumption even if a transport ignores AbortSignal, so a canceled authentication response cannot populate the token cache. A stale 401 cannot clear a newer token.

## AssemblyAI-TTS-1 integration - 2026-10-28

Official documentation read directly before implementation (the search index contained older contradictory pages):

- [Quickstart](https://www.assemblyai.com/docs/tts/getting-started/quickstart)
- [WebSocket basics and authentication](https://www.assemblyai.com/docs/tts/connect-parameters)
- [WebSocket API](https://www.assemblyai.com/docs/tts/api-reference/websocket-api)
- [Message frames](https://www.assemblyai.com/docs/tts/message-frames)
- [Voices](https://www.assemblyai.com/docs/tts/voices)
- [HTTP API](https://www.assemblyai.com/docs/tts/api-reference/http-api/overview)
- [Error handling](https://www.assemblyai.com/docs/tts/error-handling)
- [Limits](https://www.assemblyai.com/docs/tts/limits)
- [Temporary authentication](https://www.assemblyai.com/docs/tts/authenticate-with-a-temporary-token)

The server uses the documented protocol directly with websockets 14+; no SDK dependency is needed. A short buffered HTTP WAV helper supports the opt-in connectivity smoke. Runtime playback waits for `Begin`, validates the effective PCM16 mono rate and model, then sends one `Generate` (at most 1,500 code points) and `Flush`. JSON/base64 `Audio` frames are forwarded immediately through authenticated FastAPI POST `/api/sessions/{id}/audio/stream?revision=...&request_id=<UUID>` as application NDJSON. These lowercase application events are not AssemblyAI wire frames. The response ends only after `FlushDone`, byte-duration validation, `Terminate` and `Termination`. Unknown provider frames are ignored.

The browser validates application frames with Zod, explicitly decodes little-endian PCM and handles split samples. It schedules non-overlapping Web Audio buffers at the echoed sample rate, beginning before synthesis finishes. The scheduled queue is bounded to 180 seconds of audio independently of network delivery; completed scene audio is cached up to 8.64 MB of PCM (17.28 MB as decoded float samples, plus scheduled browser buffers). Pause suspends the audio timeline, mute changes gain, and Cancel aborts fetch and closes the AudioContext. Generation checks reject stale events. Scene transitions set the server stop event; client disconnect closes the generator. Its finally block sends documented `Cancel` where possible and closes the socket. Closing also discards synthesis when Cancel cannot be delivered. Canceled synthesis already passed to the model may still be billed.

No automatic retries or fallback. Each live attempt uses a UUID recorded before opening transport; duplicates get 409. Limits are deliberately below the documented 2,000-character Generate limit and free-plan five new sessions/minute. Only one live request can be active per story. Connect waits five seconds; frame inactivity waits twenty seconds; total synthesis waits 120 seconds; browser transport waits 180 seconds. WebSocket receive buffering is eight frames, each at most 1 MiB. Audio is capped at 8.64 MB. Provider errors expose only a safe code and bounded retry delay; keys and narration text are never logged.

Metrics come only from live transport: server connect-start to first decoded audio frame, and user Play to first non-silent sample on the browser output presentation timeline. Unsupported output timestamps and muted requests show unavailable. No acoustic measurement is claimed. Cached replay has no live metrics. See README for the explicit one-call paid smoke procedure. No paid live test was executed during implementation.

Sessions, budgets and UUID receipts remain process-local; keep one worker. This is production-conscious integration inside an anonymous hackathon demo, not a public-production spending control. Before exposing it publicly add durable spending limits, account authentication and operational review.

## Live HTTP smoke validation - 2026-10-29

With explicit authorization, the exact opt-in HTTP smoke ran once using the locally configured server-side key, `VOICE_PROVIDER=assemblyai` and `STORY_PROVIDER=demo`. The text was "Welcome to Blackthorn House. Your story begins now." No retry, WebSocket synthesis, broad paid suite or provider security test ran.

Result: HTTP 200; selected and echoed voice `aai-audrey`; echoed model `assemblyai-tts-1`; 24,000 Hz mono PCM16 WAV; 3.52 seconds; 169,004 bytes; 51 billed characters. WAV structure, complete non-silent PCM and echoed sample rate were checked. Offline headless Edge decoded the saved WAV and played it to completion; physical-speaker audibility and the app's live streaming path remain unverified.

The smoke now saves audio and validated metadata under ignored `test-results/assemblyai-http-smoke/`, rejects a second HTTP request, explicitly disables retries and redirects, and creates an exclusive attempt marker before transport. Another invocation requires intentional marker removal after new authorization. Secrets and raw provider response bodies/headers are excluded from reports. The existing mocked HTTP transport test passed, the live test remained skipped without opt-in, and lint passed before the paid run. No commits or pushes were made.

## Browser streaming validation preparation - 2026-10-29

Status: after the simulated rehearsal, the user explicitly authorized exactly one real WebSocket synthesis. That single live browser run passed on 2026-10-29. No additional live request or retry was made. The preceding HTTP test and this WebSocket test are separate authorized syntheses.

The adapter was checked against the current [official quickstart](https://www.assemblyai.com/docs/tts/getting-started/quickstart), [WebSocket basics](https://www.assemblyai.com/docs/tts/connect-parameters) and [message frames](https://www.assemblyai.com/docs/tts/message-frames): server-side Authorization header, authoritative Begin configuration, Generate followed by Flush, base64 raw PCM Audio, matching flush IDs and byte duration at FlushDone, Terminate/Termination, and Error handling before Begin and during synthesis/termination. Unknown frames are ignored. No automatic retries or live-to-mock fallback were found in the app path.

`backend/tools/streaming_smoke.py` is an isolated validation backend. It reuses the actual provider adapter and authenticated streaming route while substituting only the narration text, "Welcome to Blackthorn House." (28 characters), for the first medium-voice stream. It leaves the deterministic story engine and normal app entry point unchanged. This means the validation scene still displays its normal story text while the deliberately short validation narration plays. It accepts one stream, one connection, one Generate and one Flush; redirects and connection retries are blocked. A live attempt creates an exclusive marker before connecting; never remove that marker or retry a failure without new authorization.

`frontend/scripts/streaming-smoke.mjs` starts that backend on 127.0.0.1:18010 and Vite on 127.0.0.1:14183, opens the actual app in headless Edge, selects the medium, then clicks the normal Play live narration control. Both ports must be free. The browser allows only the local app origin. It observes the real fetch reader and AudioContext without collecting request headers, JWTs, raw provider errors, traces or HARs. No complete-response buffering is introduced. It compares the ordered PCM bytes with the backend SHA-256 digest and records when buffers are scheduled relative to stream completion. Timings include validation instrumentation overhead and are not a performance benchmark.

The initial playback runs without pause or mute to preserve timing observations. Once synthesis and playback complete, replay, pause/resume, mute/unmute, Cancel and scene-change cancellation use only the completed scene cache. A second browser streaming request is blocked. Cancellation of an incomplete upstream request and late-frame rejection remain covered by the mocked backend/frontend tests, so those checks do not spend a second live synthesis. No controls are retried after a failed live attempt.

Free rehearsal from the repository root:

```powershell
node frontend/scripts/streaming-smoke.mjs
```

Rehearsal uses a fixture credential and a simulated socket; it cannot open an AssemblyAI connection. Real browser PCM scheduling, output timestamp observations and control behavior are still exercised. The rehearsal passed with 12 ordered 24 kHz PCM chunks (57,600 bytes, 1.2 seconds), matching upstream/browser hashes, incremental scheduling before done, presentation observed before done, pause/resume, mute/unmute, cached replay, Cancel and scene-change cleanup. These durations and timings describe synthetic audio, not AssemblyAI performance. Mock regressions passed: 282 backend tests, one paid HTTP test skipped, and 32 frontend tests. Backend lint, frontend lint, typecheck and production build passed.

Only after explicit authorization for this one paid WebSocket test:

```powershell
$env:HAUNTCAST_LIVE_STREAM_SMOKE = '1'
try {
    node frontend/scripts/streaming-smoke.mjs --live
} finally {
    Remove-Item Env:HAUNTCAST_LIVE_STREAM_SMOKE -ErrorAction SilentlyContinue
}
```

The key is read only by the backend from its existing configuration. Live mode requires VOICE_PROVIDER=assemblyai, STORY_PROVIDER=demo, a non-placeholder key and the verified aai-audrey medium voice. The orchestrator stops its test servers and browser after the attempt; it does not start the existing HTTP smoke.

Validated reports are saved to ignored `test-results/assemblyai-stream-smoke/rehearsal/` or `live/`. Backend evidence includes Begin configuration, safe numeric provider error codes, PCM chunk/byte counts and digest, adapter first-audio timing (including connection setup), FlushDone and Termination. Termination's total_input_char_length and audio_duration_seconds are recorded if supplied; these are provider usage fields, not a dollar-credit receipt. Browser evidence includes first chunk and first output presentation relative to the initial Play click, the app's own displayed output timing, ordering, rates, completion and control results. Unsupported output timestamps are reported as unavailable. Neither headless output presentation nor the app metric verifies sound from a physical speaker.

### Authorized live result

The exact text was "Welcome to Blackthorn House." and the selected/echoed voice was `aai-audrey`. The saved evidence confirms one WebSocket connection, one Generate, one Flush and one browser streaming HTTP request. Begin confirmed `assemblyai-tts-1`, 24,000 Hz and PCM16. The backend received 27 audio chunks totaling 103,680 PCM bytes (2.16 seconds); the browser received the same ordered bytes with an identical SHA-256 digest. The HTTP response was 200, FlushDone and Termination were received, and no provider error or uncaught browser error was observed.

Measured server first audio was **4,575.48 ms** including connection setup and instrumentation. The socket observer saw the first Audio frame at 4,554.81 ms, before its report-write overhead. The browser received its first PCM event **4,802.40 ms** after Play and reported first non-silent output presentation at **4,902.13 ms** after Play. The app's own displayed output metric was 4,901 ms; its start point differs slightly from the captured DOM click. Audio buffers were scheduled and output presentation was observed before the stream's done event, so the browser did not wait for the complete response before starting playback. Headless browser output timing does not verify physical-speaker audibility and is not a latency guarantee.

Initial playback completed. Cached replay, pause/resume with a held audio timeline, mute/unmute gain changes, Cancel and scene-change cleanup all passed without another synthesis or streaming HTTP request. Both cancellation paths closed their AudioContexts. The browser and both validation servers stopped afterward. This verifies cancellation of cached playback; cancellation of a still-synthesizing real upstream request remains covered by mocks only, because a second paid request was prohibited.

Termination reported `total_input_char_length=28`, `audio_duration_seconds=2.16` and `session_duration_seconds=2`. No explicit billed-character receipt or monetary credit amount was returned over this WebSocket session; the credit charge is unknown. Do not substitute the earlier HTTP test's billing result for this session.

Evidence: ignored `test-results/assemblyai-stream-smoke/live/backend.json` and `browser.json`. The exclusive `attempt.json` remains in place. Independent checks confirmed matching PCM counts/hashes, stopped validation servers and no API key in live artifacts. Post-run regression checks forced mock mode and a dummy process-local credential, with both live flags disabled: 282 backend tests passed with the paid HTTP test skipped, and all 32 frontend tests passed. No credentials were changed on disk, and no commits or pushes were made.

Remaining limits: only the short isolated narration was synthesized live; full-scene narration, all voices, physical-speaker quality, and cancellation during an active provider synthesis have not been validated live. Any further paid request needs new explicit authorization.

## Character narration and personalized endings - 2026-10-29

All four decision chapters and all three canonical endings now have distinct Archivist, Skeptic and Medium prose. The Archivist uses observation, historical evidence and the language of records. The Skeptic moves from testable hypotheses to explicit fear as the mirror, belfry and house defeat those explanations. The Medium describes Eleanor's trust, loneliness and grief while speaking as an intimate, unsettling guide. Narrator dialogue changes with personality; core story facts and the keeper's rules are shared. No AssemblyAI emotion, style or prosody parameters were added.

Graph metadata, choice IDs, labels, hints, inventory items and effects are preserved. The ribbon still gates Liberation. Escape still uses the garden window only when opened. Inheritance still frees Eleanor only when the ribbon was untied. Narration distinguishes locating an exit from opening it, freeing an anchor from completing a rescue, and accepting the keeper's place from honoring a promise. Before the ribbon is freed, the girl's voice can follow you; the prose does not imply she is already physically out of the mirror.

Every ending recalls all three earlier decisions. Promise outcomes account for the final choice: liberation fulfills help, escape breaks the promise, and inheritance fulfills it through sacrifice only when Eleanor is freed; otherwise the promise remains broken. The discovered key/name/passage, learned bargain or exit, and ribbon/bell/window actions select the closing fragments. Each narrator has 9 Liberation, 27 Escape and 27 Inheritance variants, for 189 distinct epilogues across the existing 189 persona/path combinations.

`validate_memory()` cross-checks facts against exactly one legal decision per completed chapter, then verifies the ordered inventory and journal against that same history. Ending facts must match the chosen outcome and its prerequisites. Rendering is deterministic and does not mutate memory; choices are copied so a consumer cannot mutate the shared graph through a rendered scene. No memory fields or external story providers were introduced.

The Python Scene model and browser Zod schema enforce the existing 1,500-character narration budget. The AssemblyAI adapter uses the same Python limit. An independent enumeration of all 945 exported scene snapshots found narration lengths of 393-760 characters. The authenticated audio route continues to synthesize the exact displayed scene text in the configured persona voice: aai-george, aai-jane or aai-audrey. Existing streaming, stale-generation guards, pause/resume, mute, Cancel and scene-local cached replay are retained. Full-scene voice compatibility is checked with mocked WebSockets in this phase; no paid live requests were made and the earlier live-attempt markers were preserved.

Validation passed: 383 backend tests with the paid HTTP smoke skipped, 43 Vitest tests including all 945 cross-language snapshots, backend/frontend lint, TypeScript checks, production build, and all 12 existing Playwright desktop/mobile tests. New regressions cover per-chapter personality differences with equal outcomes, every ending variant, corrupted-memory rejection, isolated personalized sessions, every chapter/ending sent through the real streaming adapter with mocked sockets and verified voice mappings, ending replay caches, next-scene cache invalidation, and text-budget rejection. The existing Playwright ending flows also assert the actual persona epilogue and remembered promise through the real local API.

Before a UI redesign, the remaining work is editorial and product review: read the complete journeys for pacing, plan clearer feedback during the previously observed connection delay, and decide how prominently to surface narrator identity and remembered decisions. Listening review of this new full prose and real in-flight upstream cancellation would require separate explicit authorization for any paid calls. The earlier short live test's approximately 4.9-second browser output timing is not a measurement of these longer scenes.

## Security and deployment scope

The intentionally public anonymous JWT bootstrap grants access only to the caller's own stories. Runtime API docs are disabled. Request buckets are bounded and expire; session capacity is 500. A public deployment needs an HTTPS same-origin proxy, external limits, a trusted-proxy policy, operational logging that excludes tokens, and a shared store before multiple workers. Account identity and durable sessions are outside this MVP.

## Manual browser review

- Review desktop and 375px layout, keyboard navigation, reduced motion, personas and all endings.
- Test loading, play, pause, resume, mute, replay, narration completion and fallback using real device voices.
- Choose while audio loads or plays: old audio must stop.
- Disconnect the backend during a decision, reconnect and retry: only one decision is recorded.
- Restart during a pending request: its response must not reopen the old story.
- Inspect the browser bundle and network responses for accidental secrets.

All visual assets are original SVG/CSS. No stock imagery, external fonts or image generation is required.

## Automated browser review

`frontend/playwright.config.ts` starts isolated mock servers and uses installed Edge in headless mode. The dev-only Playwright dependency adds no browser code to the product. Screenshots disable animations and wait for a compositor frame so captured ending text is fully visible. Browser traces are disabled. `backend/tests/export_contracts.py` emits every scene from all complete paths for `server-contracts.test.ts`; these records are generated by Python response models rather than duplicated JavaScript fixtures.
