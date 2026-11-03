# Manual commands for operator approval

No command here was used to commit, push, install dependencies, deploy or enable paid synthesis during release preparation. Stop on any failure. These are the exact Windows workspace commands; target-host activation is separately documented in DEPLOYMENT.md.

## Validate and inspect locally

```powershell
Set-Location 'D:\dev1\hauntcast-ai'
$env:VOICE_PROVIDER = 'mock'
$env:DEPLOYMENT_MODE = 'local'
$env:ASSEMBLYAI_API_KEY = 'transport-fixture-credential'
$env:HAUNTCAST_LIVE_SMOKE = '0'
$env:HAUNTCAST_LIVE_STREAM_SMOKE = '0'
.\.venv\Scripts\python.exe -m pytest backend/tests -q
.\.venv\Scripts\python.exe -m ruff check backend tools
.\.venv\Scripts\python.exe -m pip check
Push-Location frontend
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:e2e
node scripts/streaming-smoke.mjs
Pop-Location
.\.venv\Scripts\python.exe tools/release_audit.py
git -c safe.directory=D:/dev1/hauntcast-ai status --short
git -c safe.directory=D:/dev1/hauntcast-ai config user.name
git -c safe.directory=D:/dev1/hauntcast-ai config user.email
git -c safe.directory=D:/dev1/hauntcast-ai remote -v
```

These process-local fixture variables do not modify `.env`. Close the terminal when done; do not reuse its fixture environment for live recording. No actual credential is required for this validation block.

## Stage a reviewable submission branch

The current base is `main` at `fc2a81f` (initial README). Most application files are still untracked; this release commit will include the full application snapshot. Earlier feature-separated history was not completed. Do not claim these commands reconstruct historical versions. The configured remote was `https://github.com/Venugopal1807/HanuntCast-Agent.git`; verify it before pushing.

```powershell
git -c safe.directory=D:/dev1/hauntcast-ai switch -c release/hackathon-submission
git -c safe.directory=D:/dev1/hauntcast-ai add -- .gitignore .env.example README.md DEVELOPMENT.md VALIDATION.md DEMO_GUIDE.md IMPLEMENTATION_PLAN.md RELEASE_CHECKLIST.md RELEASE_COMMANDS.md DEPLOYMENT.md SUBMISSION.md DEMO_SCRIPT.md HANDOFF.md PROJECT_CONTEXT.md
git -c safe.directory=D:/dev1/hauntcast-ai add -- backend/app backend/tests backend/tools backend/requirements.txt backend/requirements.lock.txt backend/pyproject.toml
git -c safe.directory=D:/dev1/hauntcast-ai add -- frontend/src frontend/e2e frontend/scripts frontend/index.html frontend/package.json frontend/package-lock.json frontend/eslint.config.js frontend/tsconfig.json frontend/vite.config.ts frontend/playwright.config.ts
git -c safe.directory=D:/dev1/hauntcast-ai add -- tools deploy
.\.venv\Scripts\python.exe tools/release_audit.py --staged
if ($LASTEXITCODE -ne 0) { throw 'Staged release audit failed. Do not commit.' }
git -c safe.directory=D:/dev1/hauntcast-ai diff --cached --stat
git -c safe.directory=D:/dev1/hauntcast-ai diff --cached --name-only
```

Review the actual diff locally, including all submission placeholders. Never stage `.env`, populated deployment env files, provider credentials, private proxy configuration, budget databases, audio recordings, test-results or SESSION_REPORT.md. Do not use `git add -f`. The optional local hook can be enabled with `git -c safe.directory=D:/dev1/hauntcast-ai config core.hooksPath tools/hooks`; it needs the local virtualenv. Hooks can be bypassed and are an additional check, not a substitute for review.

## Commit and push only after your review

```powershell
git -c safe.directory=D:/dev1/hauntcast-ai commit -m "Prepare safe public demo and hackathon submission"
git -c safe.directory=D:/dev1/hauntcast-ai push -u origin release/hackathon-submission
```

After reviewing that branch, optionally advance main:

```powershell
git -c safe.directory=D:/dev1/hauntcast-ai switch main
git -c safe.directory=D:/dev1/hauntcast-ai merge --ff-only release/hackathon-submission
git -c safe.directory=D:/dev1/hauntcast-ai push origin main
```

No force push is needed. If the remote moved, inspect/fetch and resolve that state before continuing; do not reset someone else's work. Deployment approval is a separate step and does not authorize a paid TTS test. Use DEPLOYMENT.md after selecting the actual host/domain.
