> **Historical engineering record (written 2026-10-20 to 2026-10-30).** Statements here about Git state ("uncommitted", "README-only main"), test counts and deployment status are dated. Current status: [README](../README.md), [DEPLOYMENT](../DEPLOYMENT.md), [VALIDATION](../VALIDATION.md). Safety rules in this file still apply.

# HauntCast AI release handoff

## Purpose and current state

BLACKTHORN HOUSE is an interactive voice-storytelling demo with three narrators, four decisions, three canonical endings and deterministic personalized epilogues. The visual refinement is implemented; release preparation adds paid-access restrictions, a cumulative ledger, deployment templates and submission documents. Read the newest VALIDATION.md entry for current executed results. Earlier test counts and historical live measurements are dated evidence, not proof that the target hosting environment works.

The working directory is `D:\dev1\hauntcast-ai`. Most code is still untracked. Git main/remote main last verified at `fc2a81f` (“HanuntCast-Agent project”), containing README only. Remote: `https://github.com/Venugopal1807/HanuntCast-Agent.git`. No release commit, feature branches, push or deployment was performed during this task. Existing author configuration belongs to the repository owner. Do not add assistant authorship or coauthor trailers. The owner requested manual Git actions for this phase; commands are in RELEASE_COMMANDS.md.

## Architecture

React/TypeScript views call a same-origin FastAPI API through `api.ts`. Zod validates frontend contracts; Pydantic validates server input/output. POST /api/auth creates an anonymous JWT identity. Ownership-protected sessions hold persona, scene, discoveries, inventory, journal and revision. UUID start/choice receipts prevent duplicate story changes; stale revisions fail. Stories expire and are process-local, so reloads lose browser tokens and backend restarts lose stories. Use one worker per instance. Public API documentation is disabled.

Story generation is local and deterministic. The browser never records microphone audio and no LLM/STT endpoint exists. Every displayed narration is the same prose submitted to TTS. The public fallback uses a generated mock WAV and optional browser-reported local English speech; it is clearly labeled. Live playback uses incremental NDJSON frames from the authenticated server route, decoded into PCM buffers and scheduled with Web Audio. Native details disclosures keep the transcript/journal/diagnostics secondary. SVG/CSS artwork is local and original.

## Important modules

| Module | Responsibility |
| --- | --- |
| `backend/app/main.py` | Auth, ownership, revisions, UUID receipts, limits, paid-route access gate, liveness and streaming |
| `models.py` | Request/response limits and scene consistency |
| `story.py`, `narration.py` | Canonical graph, memory consistency, persona prose and epilogues |
| `voice.py` | Local WAV soundscape and safe provider-error metadata |
| `assemblyai.py` | Verified HTTP/WS adapter, bounded transport, safe errors, budget reservation before network |
| `budget.py` | Existing SQLite ledger, atomic cumulative reservations, exclusive offline initialization |
| `frontend/src/App.tsx` | Landing, narrator selection, scene/ending hierarchy and request recovery |
| `AudioPlayer.tsx`, `useAudio.ts` | UI state, bounded playback, cancellation and completed scene cache |
| `pcm.ts` | PCM16 decoding/scheduling, pause-aware deadline, bounded suspend/resume |
| `SceneArt.tsx`, `Mansion.tsx`, `styles.css` | Local artwork and responsive visual system |
| `api.ts`, `contracts.ts`, `diagnostics.ts` | Abort/deadline wrapper, Zod validation and safe diagnostics |
| `backend/tools/streaming_smoke.py`, `frontend/scripts/streaming-smoke.mjs` | Isolated free rehearsal; separate explicitly gated paid mode must not be run implicitly |
| `tools/release_audit.py` | Offline eligible-file/staged/build secret check; prints filenames only |
| `tools/create_release_env.py` | Exclusive private env/proxy configuration generation without printing secrets |

## Setup and local run

Validated local runtime: Windows PowerShell, Python 3.14, Node 24 and installed Edge. Backend version snapshot: requirements.lock.txt. Frontend lockfile: package-lock.json. Installing dependencies requires network and is a manual setup step; no dependency installation or online vulnerability query was performed during release preparation. `pip check` validates installed consistency, not CVE absence. Target Linux installation remains an operator check.

```powershell
Set-Location 'D:\dev1\hauntcast-ai'
# Only create a virtualenv if it does not already exist.
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt
Push-Location frontend
npm.cmd ci
Pop-Location
# Preserve an existing .env; do not replace it.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
$env:VOICE_PROVIDER = 'mock'
$env:DEPLOYMENT_MODE = 'local'
$env:HAUNTCAST_LIVE_SMOKE = '0'
$env:HAUNTCAST_LIVE_STREAM_SMOKE = '0'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --workers 1 --no-access-log
```

In another terminal, `cd D:\dev1\hauntcast-ai\frontend`, `npm.cmd run dev`, then open the local Vite URL. Do not expose a dev server publicly. Live credentials may already exist in ignored `.env`; do not print, copy, overwrite or commit them. Setting VOICE_PROVIDER=mock in the process ensures local free playback even if a provider key exists on disk. Production must select public/restricted mode and a strong secret; local random signing keys are only a development convenience.

## Tests and evidence

Use the first block in RELEASE_COMMANDS.md. It runs pytest, Ruff, pip check, Vitest, ESLint, typecheck, build/Playwright, the simulated rehearsal and the release audit. Do not set live flags to 1 and do not pass --live. Browser tests bind isolated loopback ports 18000/14173. The rehearsal uses 18010/14183 and must run alone with free ports; its simulated socket cannot open AssemblyAI. It uses a fresh ignored test ledger and injects a fixture proxy token inside its isolated loopback backend. That harness is not the production app entry point.

Do not change runtime code while a rehearsal is active: Vite reload can cancel an in-progress stream. Stop only dedicated validation processes before retrying; never kill unrelated user services. Historical paid-attempt guards must not be removed. Screenshots, private media, state/ledger files and logs stay ignored. Contact sheets can be regenerated after Playwright using `node scripts/visual-contact-sheets.mjs` in frontend. Results are recorded in VALIDATION.md; no synthetic timing should be presented as provider speed or microphone/speaker evidence.

New safety regressions exercise concurrent reservations, persistence across new budget instances, no reset on initialization, denied/missing/wrong access tokens, exhausted/missing/corrupt/locked ledgers, no refunds after provider failure, fixed error text and credential redaction. Frontend denial tests require no retry after 403/503. Existing complete route/personalization, stale stream, cancellation, cooldown, never-settling AudioContext and early Replay coverage remains.

## TTS details and guarantees

Previously verified endpoints: `https://tts.us.assemblyai.com/v1/speech` (explicit buffered HTTP smoke) and `wss://tts.us.assemblyai.com/v1/ws` (live app). Do not substitute the older unverified hostname or Voice Agent protocol. The adapter expects Begin with model assemblyai-tts-1 and PCM16 configuration; sends Generate and Flush; decodes Audio.audio as base64 raw little-endian PCM16; validates flush/duration; waits for termination. Provider done means delivery, not speaker playback. Voice defaults are Archivist George, Skeptic Jane, Medium Audrey. No undocumented style/emotion fields are sent.

Live stream requests require an anonymous owner JWT plus private proxy token. No provider key reaches the browser. HTTP and WebSocket synthesis reserve a full attempt/text length before transport; a bounded failed attempt may still be billed, so no automatic retry/refund exists. The ledger is app-specific, not a monetary/account-wide cap. Direct local paid smoke still consumes the cumulative ledger. No web endpoint resets or administers it.

Connect/frame/total provider waits remain 5/20/120 seconds; browser transport deadline 180 seconds; playback separately excludes intentional pause time. PCM is bounded by byte/duration limits. Mute uses zero gain while the live timeline advances; Pause suspends that timeline. AudioContext operations settle on abort or within 10 seconds. Scene changes stop/close resources and invalidate stale results. Completed live replay is cache-only; incomplete/canceled/failing attempts need an explicit new Play action. Do not change these contracts while polishing release copy.

## Deployment plan

Read DEPLOYMENT.md and deploy/*.example/config/service files. Recommended public mode is mock-only, same-origin HTTPS with nginx serving frontend/dist and proxying /api to a single loopback FastAPI worker. /healthz returns liveness only and never spends credits. Vite preview is not the production web server. Streaming buffering/cache/gzip are disabled and proxy read timeout is 190 seconds. Native logs exclude credentials and request bodies; proxy access logging is disabled in samples.

Optional restricted live uses a separate private host/port, network allowlist/VPN and private header injection. The server must have an already-initialized protected cumulative SQLite ledger on durable local disk. Never initialize it during restart, autoscale independent ledgers or roll accounting back with a code release. If hosting cannot guarantee durable state, use public mock plus a restricted local recording. No hosting selection, certificates, deployment, target-host configuration test or paid recording has been completed.

## Known limitations and remaining submission work

- One-worker/process-local anonymous stories; no durable saves or accounts. A restart invalidates active sessions.
- Production platform still unselected; target OS dependency installation, nginx/systemd syntax and HTTPS/streaming checks are pending. No online dependency security audit occurred.
- Prior short live HTTP/WS success is documented, but this phase used only simulated providers. Full-scene/all-voice acoustic quality, real screen-reader use and active paid-provider cancellation remain separate authorized checks.
- Cumulative ledger safety depends on protected persistent storage and responsible operator configuration. Its volume cap does not cover other consumers of the same key or guarantee a dollar price.
- Fill SUBMISSION.md URLs/release identifier, approve and run manual Git commands, select/provision hosting and validate public mock deployment.
- Approve a bounded live recording session separately, follow DEMO_SCRIPT.md, review the exported 2–3 minute video, then publish/upload with approval.
- Review hackathon rules and eligibility manually; no compliance/award claim has been made.

## Work without agent access

The owner can run the scripts and checks, review/stage/commit/push, deploy the public mock configuration after approval, follow rollback instructions, edit submission text, record/review a demo and fill the final links. None requires an assistant or a hosted generation service. Keep secrets outside the checkout, preserve the cumulative ledger, and use manual verification gates in RELEASE_CHECKLIST.md. Paid voice testing/recording still requires explicit budget authorization regardless of tool availability.
