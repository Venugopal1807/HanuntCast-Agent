# HauntCast AI

Release preparation: deploy the anonymous public site in **mock mode only**. Paid narration now requires a private proxy access token and an existing durable cumulative synthesis ledger, in addition to JWT ownership. Read [DEPLOYMENT.md](DEPLOYMENT.md), [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) and [RELEASE_COMMANDS.md](RELEASE_COMMANDS.md) before publishing. A real provider key alone does not enable playback. No release deployment or paid test was performed in this phase.

The final visual pass adds original local SVG scenes for the entrance, portrait gallery, belfry and reckoning, plus dawn, cold-moonlight and violet-keeper ending treatments. Each ending highlights the actual belfry decision alongside the full remembered path. Personalized narration remains available in the complete transcript. Playback remains explicit: the waveform is labeled decorative, the initial voice wait has no invented percentage, and Replay keeps the existing completed-cache protection.

# HanuntCast-Agent

**BLACKTHORN HOUSE — Every ending has a voice.** A listening-first interactive horror demo built with React, TypeScript, Vite, Tailwind, and Python/FastAPI.

Choose a narrative personality, make four consequential decisions, and discover one of three endings. The Archivist reads the house as a damaged historical record. The Skeptic tests explanations until the evidence becomes unbearable. The Medium feels the presence behind Eleanor's silence. Each has original narration and dialogue throughout all chapters and endings. The server remembers your inventory, promises, discoveries, and route through the house. The interface includes an original SVG mansion, a decision journal, playback controls, and a screenshot-friendly ending card.

The MVP includes responsive desktop/mobile layouts, reduced-motion transitions, keyboard focus management, shortcuts between audio and decisions, a recoverable error screen, safe retry messages and non-secret diagnostic IDs. Playback supports play, pause, resume, replay, mute and explicit Cancel, including cancellation while audio loads.

The redesigned experience starts with a cinematic house title and a server-reported voice capability badge. Narrator cards pair perspective, a sample quote and the George/Jane/Audrey live voice badges. In each scene, a persistent narrator/player panel leads into atmosphere and large choice actions. Transcript, discoveries, journal and safe playback diagnostics are collapsed by default on desktop and mobile. Endings show a title hero, a remembered decision path, ending replay and a new-path action. Opening a transcript never starts narration. On short screens (600px high or less), the player remains in normal flow so it cannot obstruct the scene.

The landing status check only calls the existing anonymous authentication and capabilities endpoints. “Live voice ready” means the server is configured; credentials and account access are tested only when you explicitly play. An unavailable status check does not silently claim demo mode. No provider traffic occurs from landing or narrator selection.

Live mute silences output while the playback timeline continues; Pause stops that timeline. Intentional pause time does not consume the 180-second playback deadline. Provider and network timeouts remain independent. AudioContext suspend/resume operations have a cancelable 10-second deadline. Live Replay is cache-only and disabled until stream completion; after an incomplete or failed attempt, **Play live narration** explicitly starts a new synthesis and may use credits. Completed cached playback never requests synthesis again. Provider retryability and a validated 0–300-second cooldown survive streaming errors; cooldown expiry never starts a request automatically.

Inventory calls an undiscovered child “the girl”; studying the portrait still reveals Eleanor's name, and the liberation ending retains its introduction on other routes. All story routes and narrator personalization remain available.

## Integration status

- **Story:** original deterministic local fiction. No LLM or external service calls.
- **Audio:** a locally synthesized mock soundscape served as WAV. Optional spoken narration uses an installed English browser/device voice reported as `localService=true`. Where no such voice is available, the soundscape and full story text remain available.
- **AssemblyAI streaming TTS:** documented AssemblyAI-TTS-1 adapter at `wss://tts.us.assemblyai.com/v1/ws`. Opt-in live mode streams PCM incrementally; mock remains the default. On 2026-10-29, one HTTP smoke returned valid WAV audio and one separately authorized WebSocket smoke delivered 27 PCM chunks through the app to headless Edge. Incremental playback, cached replay controls and scene-change cleanup passed. Physical-speaker quality remains unverified.
- **Performance:** live requests measure server first-audio-frame and browser output presentation separately. No mock or cached-replay latency is displayed. The waveform is decorative.
- **Microphone:** not recorded. The story responds to explicit choices; “hears you” is the product tagline.
- **Competition:** a hackathon prototype, not a claim of eligibility or an award. Short HTTP and browser WebSocket TTS tests are verified; a complete live story demonstration remains pending.

See [DEVELOPMENT.md](DEVELOPMENT.md) for documentation findings, architecture and the live integration gate.

Read [HANDOFF.md](HANDOFF.md) for architecture, setup, deployment and continuation details, and [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for a concise resumption guide. The local conversation history in SESSION_REPORT.md is private and excluded from normal staging.

## Run locally

Requirements: Python 3.11+ and Node.js 20.19+ or 22.12+. Installation needs internet access. Once dependencies are installed, demo mode requires no third-party API or credentials. Use `localhost` or `127.0.0.1` in your browser for secure-context UUID support.

Windows PowerShell, from the project folder:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In a second terminal, from the project folder:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open the URL printed by Vite, normally **http://127.0.0.1:5173**. Keep both terminals running. Stop them with Ctrl+C. Vite proxies `/api` to FastAPI on port 8000.

macOS/Linux backend equivalent:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
test -e .env || cp .env.example .env
cd backend
../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

On macOS/Linux run `npm ci` and `npm run dev` in `frontend` in another terminal. `.env` is optional for the default demo. If you already have a `.env`, preserve it. Secrets belong only in backend environment variables, never `VITE_*` variables or frontend source. No provider key is needed to launch the demo.

The root `.env` is ignored by Git. The example uses these safe local settings:

```dotenv
ASSEMBLYAI_API_KEY=dummy_assemblyai_key_local_only
VOICE_PROVIDER=mock
```

The dummy value is a placeholder, not an API credential. Mock mode uses local WAV audio and never contacts AssemblyAI, even if a key is present. Missing, blank and known placeholder keys are rejected before either live transport opens. Do not overwrite an existing real key or other `.env` settings when configuring local development. Existing process environment variables take precedence over `.env`; restart the backend after changing configuration.

## Demo routes

Every ending remembers how you entered, whether you offered help, read the bargain or searched for an exit, and what you did in the belfry. A promise can be kept, broken, or fulfilled through personal sacrifice. Finding a window does not open it; untying the ribbon does not automatically mean you guided the girl out. The three outcomes remain Liberation, Escape and Inheritance. Across the 63 legal decision routes, the three narrators produce 189 distinct deterministic epilogues, without an LLM or external story service.

Voices retain their existing mappings: Archivist `aai-george`, Skeptic `aai-jane`, Medium `aai-audrey`. Personality comes from the prose and selected voice. Every scene's text fits the existing single-synthesis character budget; narration is the same text you read in the scene. Streaming controls and completed-scene replay caching are preserved. Mock mode remains free. The expanded prose was verified with mocked transports; no new paid synthesis was performed for this story update.

Start the experience, choose a persona, use **Listen**, and press **Play demo audio**. Test pause, resume, replay, mute and Cancel. **Return to choices** jumps back to the decision area. Choosing while audio plays cancels narration and advances the story. A browser play/decode attempt times out after 10 seconds; a local speech engine that fails to start or finish falls back to soundscape and text. These controls never record microphone audio.

| Ending | Example decisions |
| --- | --- |
| Liberation | Study the portrait → Promise to help → Untie the ribbon → Lead the girl into the dawn |
| Survivor | Take the key → Search for another exit → Unbolt the window → Leave |
| Inheritance | Follow the footprints → Read the ledger → Ring the bell → Become the keeper |

Freeing the ribbon unlocks liberation. Earlier decisions change subsequent narration and consequences: a key stays in your coat, a promise can be broken, an open window changes your escape route. All personalities can reach all endings. Capture an ending card with your browser screenshot tool, then enter again.

## Validation

From `backend`:

```powershell
..\.venv\Scripts\python.exe -m pytest
..\.venv\Scripts\python.exe -m ruff check .
```

From `frontend`:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e
```

Use `npm` instead of `npm.cmd` on macOS/Linux, and use `../.venv/bin/python` for backend commands. Install backend dependencies before `npm test`: its cross-language check invokes the project Python environment and validates all 945 Python-generated scene snapshots with the browser Zod contract.

The backend suite covers 189 persona/path combinations, complete HTTP flows, independent sessions, invalid transitions, ownership, token expiry, retry idempotency, concurrent decisions, audio decoding and fail-closed live mode. Frontend tests cover contracts, safe errors, the error boundary, retries, stale story/audio/speech responses, playback failures, timeouts and cancellation. Actual command results and initial failures are recorded in [VALIDATION.md](VALIDATION.md).

End-to-end tests use the installed Microsoft Edge browser in headless mode, a compiled Vite preview on port **14173** and an isolated mock backend on **18000**. The tests start and stop their own servers; those ports must be free. On a machine without Edge, install a Playwright Chromium browser and select it:

```powershell
npx.cmd playwright install chromium
$env:HAUNTCAST_BROWSER_CHANNEL = 'chromium'
npm.cmd run test:e2e
```

On macOS/Linux the equivalent is `npx playwright install chromium` followed by `HAUNTCAST_BROWSER_CHANNEL=chromium npm run test:e2e`. Desktop and 375px mobile emulation exercise every ending, actual mock-WAV playback controls, committed-request retries, keyboard navigation and pending-request cancellation. Screenshots are written under `frontend/test-results/`; this directory is ignored by Git. Browser traces and network archives are disabled so anonymous bearer tokens do not become artifacts.

## Hackathon screenshots

Capture the landing page, persona selection, an active scene with the **MOCK AUDIO** label and journal visible, and each of the three ending cards. Include a mobile story view. The browser suite automatically captures landing/personas/story on the liberation route and one card for every ending, at desktop and mobile widths. See [DEMO_GUIDE.md](DEMO_GUIDE.md) for artifact paths and a short presentation sequence.

## Diagnostics and recovery

An unexpected render failure offers **Return to the entrance** and resets the experience. Request failures offer retry or refresh; exact retries reuse the original UUID. Rate-limit responses display a wait period. In a local developer console, diagnostics include only an event category, stage, status and validated request ID. Backend errors carry an `X-Request-ID` and log route name/status with that ID. Request bodies, narration text, keys and bearer tokens are excluded from application diagnostics. Unexpected server exceptions return a generic message.

## MVP boundaries

Sessions live in one backend process and expire after one hour. A server restart loses them; a browser reload loses the in-memory anonymous identity and starts a new experience. Run one worker. Anonymous authentication creates an isolated demo identity, not a verified user account. `/api/auth` is the public bootstrap; all story, audio and capability endpoints require JWTs. Rate and capacity limits are per process.

The HauntCast stack and in-memory scope supersede the earlier mobile logistics architecture. Its visual rules are retained: Midnight Indigo, one-pixel gray borders, four-pixel corners, no shadows and bottom action areas. Zod validates browser requests and responses; Python independently validates every server input using Pydantic.

“Offline demo” means no external story/voice provider is needed. This is not a service-worker offline app; the local frontend and backend must be running. `npm run preview` previews the compiled frontend while the backend runs separately. A deployed build needs an HTTPS reverse proxy routing `/api` to FastAPI. This MVP is not claimed to be production-ready.

Browser checks verify the real mock WAV pipeline but do not establish audible quality on physical phones or verify every operating system's speech engine. Local device narration availability and delivery vary. The 2026-10-29 HTTP smoke succeeded with `aai-audrey`, 24,000 Hz mono PCM16 WAV, 3.52 seconds and 51 billed characters. The saved WAV completed local headless Edge playback. The separately authorized WebSocket test delivered 2.16 seconds of 24 kHz mono PCM16 audio incrementally through the real app; provider usage reported 28 input characters. No monetary charge was returned. Further live synthesis requires new explicit authorization.

## Enable AssemblyAI-TTS-1

When your real key is available, replace only the dummy `ASSEMBLYAI_API_KEY` value in the root `.env` with your dashboard key, set `VOICE_PROVIDER=assemblyai`, then restart FastAPI. Preserve the other settings. Keep the key server-side; never prefix it with `VITE_`, paste it into frontend code, or include it in logs. With a missing, empty or known placeholder key (including `dummy_assemblyai_key_local_only`, `your_api_key_here`, `changeme` and `test-key`), capabilities and audio requests return HTTP 503 with an explicit configuration error; the existing frontend error screen displays it. Live mode never silently switches to mock. Placeholder detection is local and does not prove an unrecognized key is genuine or has account access. Persona voices are selected with the three `ASSEMBLYAI_VOICE_*` variables in `.env.example`; the verified English allowlist is `aai-george`, `aai-jane`, and `aai-audrey`. Changing voices requires a backend restart.

First test connectivity with exactly one short HTTP WAV call (uses credits), from the repository root with credentials available in the environment:

```powershell
$env:HAUNTCAST_LIVE_SMOKE = '1'
.\.venv\Scripts\python.exe -m pytest backend/tests/test_tts.py::test_live_http_once -q
Remove-Item Env:HAUNTCAST_LIVE_SMOKE
```

The smoke imports backend settings, which load the root `.env`. Never enable the smoke flag for the full suite. It speaks only "Welcome to Blackthorn House. Your story begins now." using the configured medium voice, disables HTTP retries and redirects, and blocks a second request. It saves the WAV and validated response metadata under the ignored `test-results/assemblyai-http-smoke/` directory. An exclusive `attempt.json` marker prevents accidental reruns, including after failure; remove this marker only after explicitly authorizing another paid synthesis. It checks WAV structure and non-silent PCM, not speaker audibility. Next start the app, choose a persona, and select **Play live narration** only when another live synthesis is authorized. Validate Pause, Resume, Mute, Replay, Cancel, scene choice and restart. Completed Replay uses scene-local memory without another paid call; an interrupted attempt needs explicit retry and may have incurred credits. A new scene clears cached audio.

The server permits four new synthesis attempts per minute across this process, one active stream per story, twenty attempts per story, 1,500 text code points per request and 180 seconds/8.64 MB of PCM. It performs no automatic upstream retries. For public deployment add durable account-level budgets and authenticated accounts: anonymous identities and process-local limits do not enforce a spending cap across restarts or workers.

Use a streaming same-origin proxy with response buffering disabled and an idle timeout above the application's deadlines. Browser output timing uses `AudioContext.getOutputTimestamp()` when supported and unmuted; it observes the browser audio output timeline, not acoustic sound from a physical speaker. First-frame timing includes connection setup and is logged with the non-secret provider session UUID. No latency is claimed before a real audio frame arrives.

A guarded browser WebSocket smoke is available separately from the HTTP smoke. Run `node frontend/scripts/streaming-smoke.mjs` from the repository root for a free rehearsal with simulated provider frames and real browser Web Audio. One authorized live run passed; its attempt marker is retained to block reruns. Further live execution requires new explicit authorization; see [the browser streaming validation procedure and result](DEVELOPMENT.md#browser-streaming-validation-preparation---2026-10-29).
