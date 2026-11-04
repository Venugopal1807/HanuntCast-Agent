> **Historical engineering record (written 2026-10-20 to 2026-10-30).** Statements here about Git state ("uncommitted", "README-only main"), test counts and deployment status are dated. Current status: [README](../README.md), [DEPLOYMENT](../DEPLOYMENT.md), [VALIDATION](../VALIDATION.md). Safety rules in this file still apply.

# HauntCast demo guide

Release gate: the public hosted demo must use mock mode. Live playback additionally requires private proxy/network access and a durable cumulative budget; valid provider credentials alone are insufficient. Follow DEMO_SCRIPT.md for the approved recording sequence and DEPLOYMENT.md for the guarded setup. Do not run a paid demo or smoke test under the current release-preparation authorization.

Start the backend and frontend with README.md's two-terminal commands. Explicit `VOICE_PROVIDER=mock` needs no API key and makes no external requests. The full story and mock soundscape work locally; installed English device narration is optional. With `VOICE_PROVIDER=assemblyai` and valid server-side credentials, the app offers live AssemblyAI-TTS-1 narration using account credits. Do not press live Play without authorization for paid synthesis.

## Presentation sequence

1. Show BLACKTHORN HOUSE, the atmospheric mansion and the server-reported capability badge. Use Start the experience. The badge reports configuration, not a paid provider health check; there is no microphone capture.
2. Select a personality. This changes narrative perspective and, in configured live mode, selects its mapped AssemblyAI voice. Mock mode can use optional local device narration.
3. Enter the house and show the narrator/player panel above the scene and choices. Press Play demo audio with the MOCK AUDIO label visible. Demonstrate pause, resume and Cancel. Open Playback settings & diagnostics to select optional local device narration. Transcript and journal start collapsed.
4. Study the portrait, promise to help, untie the ribbon, then lead Eleanor into the dawn. Expand Discoveries & decision journal to show retained choices. Read the scene transcript is available at any time; opening it does not start audio.
5. Show the ending hero, remembered decision path, ending transcript and Replay ending. Enter again to demonstrate either escape or inheritance using README.md's routes.
6. State the integration boundary accurately: the documented AssemblyAI-TTS-1 adapter is available when configured. Earlier authorized short HTTP and browser WebSocket tests succeeded; full-story live narration and physical-speaker quality remain unverified. This correction phase makes no paid requests. Mock timings are not live latency measurements.

For an already-authorized live demonstration, Mute means silent output with continuing playback; Pause stops the timeline, including during a long pause. Replay is disabled until the complete stream is cached and then uses only that cache. Loading, canceled and failed incomplete streams cannot be replayed; a new Play action may spend credits. Provider cooldowns disable playback until expiry but never retry automatically. In mock mode, muting holds optional local speech and silences the soundscape.

## Screens to capture

| Screen | Evidence to show |
| --- | --- |
| Landing, desktop | BLACKTHORN HOUSE, mansion, capability badge, Start the experience |
| Persona selection | All three personalities and selected state |
| Active scene | Narrator/player above atmosphere and choices; collapsed transcript and journal |
| Audio playing | Explicit mock status and pause/replay/mute/Cancel controls |
| Liberation ending | Eleanor released, journal and ending badge |
| Survivor ending | Escape consequence reflects prior choices |
| Inheritance ending | Keeper consequence and different ending badge |
| Mobile scene | Readable text, touch targets, Listen/Return shortcuts |

Run `npm.cmd run test:e2e` in `frontend` to regenerate desktop/mobile screenshots. Files are under:

```text
frontend/test-results/experience-complete-real-API-route-to-liberation-desktop/
  landing.png
  personas.png
  story.png
  ending-liberation.png
frontend/test-results/experience-complete-real-API-route-to-escape-desktop/ending-escape.png
frontend/test-results/experience-complete-real-API-route-to-inheritance-desktop/ending-inheritance.png
```

Equivalent folders ending in `-mobile` contain the 375px captures. These generated images are ignored by Git. The suite validates real audio-element playback with mock WAV data, not speaker output or AssemblyAI speech. Capture a manual playing-audio screen on your presentation machine after selecting an installed local voice, if desired.

## Next validation boundary

Use the free streaming rehearsal for browser scheduling, pause, mute, cached replay and cancellation checks. Any further live synthesis requires explicit authorization; do not remove existing paid-attempt guards. Full-scene live narration, all voices and active-provider cancellation still need separately authorized validation. See VALIDATION.md for current offline results before beginning the UI/UX redesign.
