# BLACKTHORN HOUSE — hackathon submission

## One line

An interactive horror story told aloud by AssemblyAI voices: choose your narrator, make four decisions, hear your ending.

## Short description (paste-ready, about 100 words)

BLACKTHORN HOUSE is a listening-first interactive horror story. Three narrators, the Archivist, the Skeptic and the Medium, tell the same haunted house in three distinct personalities, each voiced by AssemblyAI-TTS-1 (George, Jane, Audrey). You make four decisions. The house remembers the key in your coat, the promise you made and the window you opened, and every ending (Liberation, Escape or Inheritance) is narrated with an epilogue personalized to your path: 189 in total. Narration always speaks the exact text on screen. A credit-safe architecture keeps the API key server-side, the public demo plays labeled pre-generated AssemblyAI audio, and live streaming stays restricted.

## How AssemblyAI is integrated

- **Model and voices:** AssemblyAI-TTS-1 with `aai-george`, `aai-jane` and `aai-audrey`, one voice per narrator.
- **Pre-generated narration (public demo):** `backend/tools/pregenerate_narration.py` walks the real story engine and synthesizes every unique scene text once through the HTTP `/v1/speech` endpoint (MP3, 48 kbps). Each request is reserved in a budget ledger before it is sent, with no retries. Files are keyed by SHA-256 of narrator plus exact text, and the browser verifies that key before playing, so audio can never mismatch the prose. The UI labels it **ASSEMBLYAI · PRE-GENERATED**.
- **Live streaming (restricted):** `backend/app/assemblyai.py` uses the TTS WebSocket (`Begin` → `Generate` → `Flush` → `Audio` frames → `FlushDone` → `Terminate`). PCM16 chunks are forwarded as NDJSON, and `frontend/src/pcm.ts` schedules them in Web Audio as they arrive. Pause, mute, cancel, stale-scene cancellation and cache-only replay are supported. It requires a JWT, a private proxy token and a durable spending ledger.
- **Evidence:** on 2026-10-29, one authorized HTTP synthesis (Audrey, 51 characters, 3.52 s) and one authorized WebSocket stream (27 chunks, played incrementally in Edge) both succeeded. That HTTP sample ships in the app on the Medium's narrator card.

## Architecture

```
Browser (React 19 + Zod)                     FastAPI (one worker)
 ├─ landing → narrator cards ── /narration/*.mp3|wav  (static, pre-generated AssemblyAI audio)
 ├─ scene player ──────────── POST /api/auth → JWT (anonymous)
 │                            POST /api/sessions, /choices  → deterministic story engine
 │                            GET  /api/sessions/{id}/audio → mock soundscape (fallback)
 └─ live player (restricted) ─ POST …/audio/stream → AssemblyAI TTS WebSocket → NDJSON PCM
                                  ↑ requires proxy token + SQLite ledger reservation
```

The story engine (`backend/app/story.py`, `narration.py`) is deterministic and server-owned: Pydantic validates every request and Zod validates every response. Retries are idempotent (request UUIDs plus revisions), and every route is enumerated in the tests. There is no LLM, microphone or speech recognition.

## 60–90 second demo video storyboard

| Time | Screen | Voice-over |
| --- | --- | --- |
| 0:00–0:08 | Landing page; slow scroll over the mansion and the "How it works" strip. | "Blackthorn House is a horror story you listen to. AI voices tell it, and your choices change it." |
| 0:08–0:22 | Narrator cards. Click **Hear Audrey** and let the real sample play. (After the approved generation run, also play George and Jane for 2–3 seconds each.) | "Three narrators, three AssemblyAI voices: the Archivist, the Skeptic, the Medium. Same house, different minds." |
| 0:22–0:40 | Enter as the Medium. The badge shows **ASSEMBLYAI · PRE-GENERATED**. Press **Hear Audrey narrate** and let 6–8 seconds play. | "Every scene is narrated with AssemblyAI-TTS-1, and it's exactly the text you see." |
| 0:40–0:58 | Choose *Study the portrait* → *Promise to help* → *Untie the ribbon*. Briefly open the decision journal. | "Four decisions. The house remembers the name you found, the promise you made, the ribbon you untied." |
| 0:58–1:15 | Choose *Lead the girl into the dawn*. The Liberation ending card appears; play the ending narration for a few seconds. | "One of three endings, with an epilogue built from your whole path. 189 of them." |
| 1:15–1:28 | Brief cut to the architecture diagram or code: pre-generation tool, live WebSocket adapter, budget ledger. | "The public demo plays pre-generated audio. Live streaming runs over AssemblyAI's WebSocket behind a token and a spending ledger, so credits stay safe." |

Recording rules: capture system audio, keep the labels visible, and show no `.env`, keys, terminals or private URLs. If the scene recordings haven't been generated, record the Audrey sample and a MOCK AUDIO scene, and say so in the voice-over. Don't call the soundscape AssemblyAI speech. For a longer, live-streaming version (which needs paid approval) see [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Demo script for a live judge walkthrough (about 2 minutes)

1. Open the public URL; if it's on Render's free tier, wake it a minute beforehand.
2. Landing: read the one-line pitch, then **Start the experience**.
3. Narrator cards: press **Hear Audrey**, then select the Medium and **Enter Blackthorn House**.
4. Press the play button (labeled pre-generated when a recording exists), then pause and resume.
5. Make the four Liberation choices; on the ending, play the narration and open **Your path remembered**.
6. **Enter again** and pick the Skeptic to show the different voice and prose.

## Submission form (Google Form from the 28 Oct Discord announcement)

Form: https://forms.gle/XCW2RdZGbarVLnKEA. Its header still says "(Oct 17 to Oct 24)", but the organizer reopened it on 28 Oct. The older 16 Oct link is not the one to use.

| Form field | What to enter |
| --- | --- |
| What are you submitting? * | The project option |
| Team or submitter name * | Your name (fill in yourself) |
| Primary contact email * | Your email (fill in yourself) |
| Discord username * | Your Discord username (fill in yourself) |
| Team members | Leave blank if you're a solo submitter |
| Twitter or LinkedIn | Your profile links, plus the X and LinkedIn post links once posted |
| Project name | BLACKTHORN HOUSE |
| Tagline | The one-line pitch above |
| Project description (required for projects) | The short description above, then the "How AssemblyAI is integrated" bullets |
| Demo video link (required for projects) | `<DEMO_VIDEO_URL>` (YouTube unlisted, Loom or Drive) |
| Source code repository link (required for projects) | https://github.com/Venugopal1807/HanuntCast-Agent |
| Tech stack | AssemblyAI-TTS-1 (HTTP `/v1/speech` and WebSocket streaming), voices aai-george, aai-jane and aai-audrey; FastAPI, Pydantic, PyJWT, SQLite spending ledger; React 19, TypeScript, Vite, Zod, Web Audio; Docker on Render |
| Live demo link | https://blackthorn-house.onrender.com (free tier: the first visit after idling can take about 50 s) |
| Bugs / Feedback | Optional |
| File upload (max 10 MB) | Optional: a screenshot from `docs/` or `media/` |

## Deadline and scoring notes (checked 2026-11-05)

- **Deadline:**
  - Discord says only "7th November".
  - The official [Luma page](https://luma.com/msrwwjby) ends at "Nov 8, 12:30 AM GMT+5:30", which is 7 Nov 19:00 UTC.
  - The Voice AI Space listing gives "Sat 7 Nov 11:00 PDT", which is 23:30 IST on 7 Nov.
  - **Treat 23:30 IST on 7 Nov as the cutoff, and submit on 6 Nov.**
- **Judging:** no criteria are posted. The organizer's scoring hints on Discord:
  - extra points for posting the project on LinkedIn and X tagging the organizer and AssemblyAI
  - the project must use AssemblyAI
  - multiple submissions are allowed
- **Prizes:** $2,000 across 20 winners, paid as Visa gift cards.

## Narration runbook (run when the AssemblyAI balance is confirmed)

The approved scope is at most 246 requests and 139,550 characters (`all`), falling back to `chapters` (57 / 26,753), then `openings` (3 / 1,345). Each tier runs only if the balance covers it in full. From the repository root in PowerShell:

```powershell
.\.venv\Scripts\python.exe backend\tools\pregenerate_narration.py --tier all        # free dry run: must print 246 requests / 139550 characters
$env:HAUNTCAST_PREGENERATE_APPROVED = 'all:139550'                                  # approves exactly this plan
.\.venv\Scripts\python.exe backend\tools\pregenerate_narration.py --tier all --execute
Remove-Item Env:HAUNTCAST_PREGENERATE_APPROVED
.\.venv\Scripts\python.exe backend\tools\verify_narration.py --tier all             # every file, hash, voice and ending must pass
node frontend\scripts\verify-narration-playback.mjs http://127.0.0.1:5173           # every file decodes in Edge
```

Each request is reserved first in `release-private/pregenerate-all.sqlite3` (ignored by Git). The run stops on the first error with no retry, and re-running skips finished files. A failed request's reservation is not refunded, so a resumed run needs a new, smaller approval and a new ledger path. Then record the demo with `node frontend\scripts\record-demo.mjs http://127.0.0.1:5173 frontend\test-results\demo <path-to-ffmpeg.exe>`. The final mode refuses to record if any scene would use mock audio.

## Social posts (drafts; post from your own accounts)

The organizer asked entrants to tag him (Harnoor) and AssemblyAI on both LinkedIn and X; posts that do get extra points. On X, `@iHarnoorSingh` appears in other entrants' posts, but the organizer hasn't stated it, so check his X profile before posting. On LinkedIn, type @ and pick AssemblyAI and Harnoor from the suggestions. The organizer gave no hashtags.

**X:**
> I built BLACKTHORN HOUSE for @AssemblyAI's Voice Hackathon Week (cc @iHarnoorSingh): an interactive horror story told aloud by AssemblyAI TTS-1 voices. Pick one of three narrators, make four choices, and hear one of 189 personalized endings. 🕯️
> Demo: https://blackthorn-house.onrender.com · Code: https://github.com/Venugopal1807/HanuntCast-Agent

**LinkedIn:**
> For AssemblyAI's Voice Hackathon Week (thanks, Harnoor, for running it), I built BLACKTHORN HOUSE: a listening-first interactive horror story narrated by AssemblyAI's new TTS-1 model.
> Three narrators (George, Jane and Audrey) tell the same haunted house in very different voices. Four decisions shape the night, and every ending (there are 189 personalized epilogues) remembers your path.
> Under the hood: React + FastAPI, a deterministic story engine, narration pre-generated with TTS-1 and verified against the exact scene text, plus a credit-safe live WebSocket streaming mode behind a spending ledger.
> Demo: https://blackthorn-house.onrender.com · Video: <DEMO_VIDEO_URL> · Code: https://github.com/Venugopal1807/HanuntCast-Agent
> #AssemblyAI #VoiceAI #TextToSpeech #Hackathon

## Remaining manual actions

1. Approve, or decline, the pre-generation run (exact plan in [VALIDATION.md](VALIDATION.md)), then review the audio.
2. Approve the commit and push of the release changes.
3. Create or sign in to a free Render (or Hugging Face) account and deploy using [DEPLOYMENT.md](DEPLOYMENT.md); set `JWT_SECRET`.
4. Test the public URL on a desktop browser and on a real phone.
5. Record the 60–90 s video, review it, upload it, and fill in the links above.
6. Read the submission form and rules on the organizer's Discord. Submit before **23:30 IST on 7 Nov** (aim for 6 Nov).

## Known limitations (stated honestly)

- One hand-written scenario, four decisions, three endings. Stories live in memory on one worker; a restart or reload starts over.
- Until the generation run is approved, real AssemblyAI audio in the public demo is limited to the Medium's 3.5-second sample; scenes use the labeled mock soundscape.
- No microphone, speech recognition, accounts or saved progress. No performance numbers are claimed.
