# Implementation plan

1. Inspect workspace and tooling; initialize an isolated Git repository.
2. Implement Blackthorn House with server-owned memory, four decisions and three endings.
3. Add JWT-protected session, choice, capability and mock-audio routes. Use revision checks and UUID receipts for safe retries.
4. Build React persona selection, story scenes, journal, narration controls and ending cards.
5. Separate story and voice providers. Keep AssemblyAI disabled until its exact standalone TTS protocol is documented and tested.
6. Enumerate story paths, test failed requests and stale responses, run lint/type checks/build, then document actual results.

Architecture: React + TypeScript + Vite + Tailwind and Zod contracts communicate with a single-worker FastAPI backend. Expiring in-memory sessions contain persona, revision, inventory, facts and journal. Deterministic story and mock voice adapters work without provider credentials. Original SVG/CSS uses Midnight Indigo, gray borders, four-pixel corners and no shadows.
